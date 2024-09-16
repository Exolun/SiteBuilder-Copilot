// https://blog.logrocket.com/how-to-build-tab-component-react/
import { ReactElement, ReactNode } from "react";

export interface TabItemProps {
    name: string;
    children: ReactNode;
}

export interface TabListProps {
    activeTabIndex: number;
    children: ReactElement<TabItemProps> | ReactElement<TabItemProps>[]
}