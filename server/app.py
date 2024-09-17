from flask import Flask, request, jsonify, send_from_directory, url_for
from mimetypes import guess_type
from flask_cors import CORS
import os
from agent_factory import AgentFactory
import requests
import re
import asyncio

app = Flask(__name__)
CORS(app)

agent_factory = AgentFactory()

import asyncio
from flask import Flask, request, jsonify, url_for
import os

@app.route('/sendprompt/<sessionId>', methods=['POST'])
async def send_prompt(sessionId):
    if 'prompt' not in request.form:
        return jsonify({"error": "No prompt provided"}), 400

    prompt = request.form['prompt']
    file = request.files.get('file')
    file_content = None

    session_dir = get_session_directory(sessionId)
    deprecate_index_template(sessionId)
    if not os.path.exists(session_dir):
        os.makedirs(session_dir)

    agents = agent_factory.get_or_create_agents(sessionId)
    orchestrator_agent = agents["orchestrator_agent"]
    template_agent = agents["template_agent"]

    try:
        if file:
            file_content = saveAttachment(file, sessionId)

        plaintext_response = orchestrator_agent.send_prompt(prompt, file_content)
        asyncio.create_task(asyncio.to_thread(process_template, prompt, file_content, sessionId, template_agent))
        orchestrator_agent.save(os.path.join(session_dir, 'agents', 'orchestrator_agent.json'))

        return jsonify({
            "response": plaintext_response,
        }), 200
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

def deprecate_index_template(sessionId):
    template_dir = os.path.join(get_session_directory(sessionId), 'template')
    os.makedirs(template_dir, exist_ok=True)
    index_path = os.path.join(template_dir, 'index.html')
    deprecated_path = os.path.join(template_dir, 'index.html.old')
    
    if os.path.exists(index_path):
        if os.path.exists(deprecated_path):
            os.remove(deprecated_path)
        os.rename(index_path, deprecated_path)


@app.route('/getoutput/<sessionId>', methods=['POST'])
async def get_output(sessionId):
    html_content = None
    session_dir = get_session_directory(sessionId)
    template_path = os.path.join(session_dir, 'template', 'index.html')

    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        template_url = url_for('serve_html_template', session_id=sessionId, filename='index.html', _external=True)
    else:
        # If the template does not exist yet, return a not ready status
        return jsonify({"status": "not ready"}), 200

    return jsonify({
            "status": "ready",
            "htmldata": html_content,
            "templateurl": template_url
        }), 200
    
def process_template(prompt, file_content, sessionId, template_agent):
    html_response = template_agent.send_prompt(prompt, file_content)
    session_dir = get_session_directory(sessionId)
    template_agent.save(os.path.join(session_dir, 'agents', 'template_agent.json'))
    html_response = trim_markdown(html_response)
    saveTemplate(html_response, sessionId)
    
@app.route("/jobs/<session_id>/<filename>", methods=["GET"])
def serve_html_template(session_id, filename):
    asset_dir = os.path.join(get_session_directory(session_id), 'template')
    asset_path = os.path.join(asset_dir, filename)
    
    if not os.path.exists(asset_path):
        return jsonify({"error": ""}), 404

    return send_from_directory(asset_dir, filename, as_attachment=False, mimetype=guess_type(filename)[0])

@app.route('/getimage/<session_id>', methods=['POST'])
def get_image(session_id):
    if 'prompt' not in request.form:
        return jsonify({"error": "No prompt provided"}), 400

    raw_image_prompt = request.form['prompt']
    
    try:
        image_prompt = f"""Please generate an image that encapsulates the vibe of the following prompt:

        {raw_image_prompt}
        """
        agents = agent_factory.get_or_create_agents(session_id)
        image_gen_agent = agents["image_gen_agent"]

        # Get the image URL from the LLM client
        image_url = image_gen_agent.generate_image(image_prompt)

        # Download the image
        try:
            response = requests.get(image_url)
            response.raise_for_status()  # Check if the request was successful
            image_dir = os.path.join(get_session_directory(session_id), 'images')
            file_path = os.path.join(image_dir, "background.png")
            with open(file_path, "wb") as file:
                file.write(response.content)
            print("Image saved as background.png")
        except Exception as e:
            print(f"An error occurred while downloading the image: {e}")

        return jsonify({'image': image_url}), 200
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/messages/<sessionId>', methods=['GET'])
def get_messages(sessionId):
    try:
        agents = agent_factory.get_or_create_agents(sessionId)
        orchestrator_agent = agents["orchestrator_agent"]
        
        return jsonify({'messages': orchestrator_agent.get_messages()}), 200
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500        

    
@app.route('/newchat/<sessionId>', methods=['POST'])
def new_chat(sessionId):
    try:
        agents = agent_factory.get_or_create_agents(sessionId)
        orchestrator_agent = agents["orchestrator_agent"]
        template_agent = agents["template_agent"]        
        
        # Initialize a new chat session
        orchestrator_agent.reset()
        template_agent.reset()

        return jsonify({'message': 'New chat session initialized'}), 200
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

@app.route('/sessionhistory', methods=['GET'])
def get_session_history():
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        jobs_dir = os.path.join(current_dir, 'jobs')
        return jsonify([d for d in os.listdir(jobs_dir) if os.path.isdir(os.path.join(jobs_dir, d))])
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

def saveAttachment(file, session_id):
    upload_dir = os.path.join(get_session_directory(session_id), 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    file.save(file_path)
    
    with open(file_path, 'rb') as f:
        file_content = f.read()
    
    return file_content

def saveTemplate(html_content, session_id):
    """
    Saves the HTML content to an index.html file in the session's directory.
    
    Args:
    html_content (str): The HTML content to save.
    session_id (str): The session ID to determine the directory.
    
    Returns:
    str: The filename of the saved index.html file.
    """
    template_dir = os.path.join(get_session_directory(session_id), 'template')
    os.makedirs(template_dir, exist_ok=True)
    file_path = os.path.join(template_dir, 'index.html')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    return 'index.html'

# A helper function that trims out markdown surrounding html, ```html and ``` code blocks
def trim_markdown(text):
    # Remove leading and trailing whitespace
    text = text.strip()
    # Remove ```html from the beginning
    text = re.sub(r'^```html', '', text)
    # Remove ``` from the beginning and end
    text = re.sub(r'^```|```$', '', text)
    return text.strip()

def get_session_directory(session_id):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, 'jobs', session_id)

if __name__ == '__main__':
    app.run(debug=True)