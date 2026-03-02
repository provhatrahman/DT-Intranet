import { BaseApp } from "../base/types";
import { ApiTesterAppComponent } from "./components/ApiTesterAppComponent";

export const helpItems = [
  {
    icon: "🔌",
    title: "API Testing",
    description: "Test Greenroom Backend API endpoints and view responses",
  },
  {
    icon: "📋",
    title: "Select Endpoint",
    description: "Choose an endpoint from the dropdown to test",
  },
  {
    icon: "⚙️",
    title: "Configure Request",
    description: "Set query parameters, request body, and resource IDs",
  },
  {
    icon: "▶️",
    title: "Send Request",
    description: "Click the Send button to execute the API request",
  },
];

export const appMetadata = {
  name: "API Tester",
  version: "1.0.0",
  creator: {
    name: "Ryo Lu",
    url: "https://ryo.lu",
  },
  github: "https://github.com/ryokun6/ryos",
  icon: "/icons/default/mac-classic.png",
};

export const ApiTesterApp: BaseApp = {
  id: "api-tester",
  name: "API Tester",
  icon: { type: "image", src: appMetadata.icon },
  description: "Test Greenroom Backend API endpoints",
  component: ApiTesterAppComponent,
  helpItems,
  metadata: appMetadata,
  windowConstraints: {
    defaultSize: { width: 1000, height: 700 },
    minSize: { width: 800, height: 500 },
  },
};



