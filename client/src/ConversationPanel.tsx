// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import React from "react";
import './ConversationPanel.css';
import { SessionDetails } from './types/SessionTypes';
import { AiResponse } from "./types/ConversationTypes";

interface Conversation {
  prompt: string;
  response: AiResponse;
}

interface ConversationPanelProps {
  conversations: Conversation[];
  sessionHistory: SessionDetails[];
  selectedSession: string;
  handleNewChat: () => Promise<void>;
  handleDeleteChat: () => Promise<void>;
  handleSessionSelectCallback: (sessionId: string) => void;
  handleSendWithPrompt: (prompt: string) => void;
  handleModal: (newIsOpen: boolean) => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversations,
  sessionHistory,
  selectedSession,
  handleNewChat,
  handleDeleteChat,
  handleSessionSelectCallback,
  handleSendWithPrompt,
  handleModal
}) => {

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const sessionId = event.target.value;
    handleSessionSelectCallback(sessionId);
    handleModal(false);
  }

  const handleSuggestionClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const suggestion = event.currentTarget.textContent;
    if (suggestion) {
      handleSendWithPrompt(suggestion);
      const element = document.getElementById('conversations-container');
      if (element && element.lastElementChild) {
        setTimeout(() => {
          element.parentElement!.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }    }
  }

  const renderContent = (content: string) => {
    const imageTagMatch = content.includes("![image]");
    if (imageTagMatch) {
      const src = content.split("](")[1].replace(")", "");
      return <img src={src} style={{ width: '50%', height: '50%' }} />;
    }
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }

  const renderResponseSuggestions = (aiResponse: AiResponse) => {
    if (!aiResponse.responseSuggestions.length) {
      return null;
    } else {
      return (
        <div className="ai-response-suggestions">
          {aiResponse.responseSuggestions.map((suggestion, index) => (
              <button key={index} className="response-suggestion" onClick={handleSuggestionClick}>
                {suggestion}
              </button>
            ))
          }
        </div>
      );
    }
  };


  const parseFiles = (message: string) => {
    const userImageUploadRegex = /!\[User Image Upload\]\(http:\/\/127\.0\.0\.1:5000\/[^/]+\/template\/img\/[^)]+\)/g;
    const fileUploadRegex = /!\[File Uploaded\]\([^)]+\)/g;
    const combinedRegex = new RegExp(`${userImageUploadRegex.source}|${fileUploadRegex.source}`, 'g');

    return message.replace(combinedRegex, (match) => {
        const url = match.match(/\(([^)]+)\)/)?.[1];
        const fileName = url?.split('/').pop();
        return `<br/><br/><span class='file-attachment-label'><i class="fa fa-file"></i>&nbsp; ${fileName}</span>`;
    });
};

  return (
    <div id="conversation" className="conversations">
      <div id="conversation-header" className="conversation-header">
        {sessionHistory &&
          <select id="session-history" onChange={handleSelect} value={sessionHistory.find((detail) => selectedSession === detail.sessionId) ? selectedSession : "DEFAULT"}>
            <option value="DEFAULT" disabled>Select a previous chat</option>
            {sessionHistory.map((sessionDetails) => (
              <option key={sessionDetails.sessionId} value={sessionDetails.sessionId}>
                {sessionDetails.title || sessionDetails.sessionId}
              </option>
            ))}
          </select>
        }
        <div id="conversation-header-buttons">
          <div id="new-chat-button-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
            <button
              id="new-chat-button"
              title="Start a new chat"
              onClick={async () => await handleNewChat()}>
              <svg fill="currentColor" aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.5 9.5a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3v-3a.5.5 0 0 0-1 0v3h-3ZM18 10a8 8 0 1 0-16 0v.35l.03.38c.1 1.01.38 1.99.83 2.89l.06.12-.9 3.64-.02.08v.08c.03.3.31.52.62.45l3.65-.91.12.06A8 8 0 0 0 18 10ZM3 10a7 7 0 1 1 3.58 6.1l-.09-.03-.1-.02a.5.5 0 0 0-.18 0l-3.02.76.75-3.02.02-.1a.5.5 0 0 0-.07-.27A6.97 6.97 0 0 1 3 10Z" fill="currentColor"></path>
              </svg>
            </button>
          </div>
          <div id="delete-chat-button-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
            <button
              id="delete-chat-button"
              title="Delete this chat"
              onClick={async () => await handleDeleteChat()}>
              <svg fill="none" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 11V17" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 11V17" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 7H20" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 7H12H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />            </svg>
            </button>
          </div>
        </div>
      </div>
            <div id="conversations-container">
      {conversations.length === 0 ? (
          <div className="conversation">
            <div className="ai-response">
              <b>Copilot:</b> Hi, I am SiteBuilder Copilot. I'm excited to start building your website with you!
            </div>
          </div>
        ) : (
          conversations.map((conversation, index) => (
            (
              <div key={index} className="conversation">
                <div className="submitted-prompt">
                  {renderContent(parseFiles(conversation.prompt))}
                </div>
                <div id="ai-response-container">
                  <div
                    className="ai-response"
                    dangerouslySetInnerHTML={{ __html: '<b>Copilot:</b> ' + conversation.response.message.replace(/```json\s*$/, '').trimEnd() }}
                  />
                  {renderResponseSuggestions(conversation.response)}
                </div>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
};

export default ConversationPanel;