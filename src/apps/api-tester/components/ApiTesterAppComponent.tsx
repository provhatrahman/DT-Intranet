import { useState, useCallback } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ApiTesterMenuBar } from "./ApiTesterMenuBar";
import { HelpDialog } from "@/components/dialogs/HelpDialog";
import { AboutDialog } from "@/components/dialogs/AboutDialog";
import { useThemeStore } from "@/stores/useThemeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_ENDPOINTS, BASE_URL } from "../config";
import { ApiEndpoint, ApiResponse } from "../types";
import { toast } from "sonner";
import { Play, Loader2, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ApiTesterAppComponent({
  isWindowOpen,
  onClose,
  isForeground,
  skipInitialSound,
  instanceId,
  onNavigateNext,
  onNavigatePrevious,
}: AppProps) {
  const currentTheme = useThemeStore((state) => state.current);
  const isXpTheme = currentTheme === "xp" || currentTheme === "win98";

  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [resourceId, setResourceId] = useState("");
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState<Record<string, unknown>>({});
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);

  const helpItems = [
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

  const appMetadata = {
    name: "API Tester",
    version: "1.0.0",
    creator: {
      name: "Ryo Lu",
      url: "https://ryo.lu",
    },
    github: "https://github.com/ryokun6/ryos",
    icon: "/icons/default/mac-classic.png",
  };

  const categories = Array.from(new Set(API_ENDPOINTS.map((e) => e.category)));

  const handleEndpointSelect = useCallback((endpointId: string) => {
    const endpoint = API_ENDPOINTS.find((e) => e.id === endpointId);
    if (endpoint) {
      setSelectedEndpoint(endpoint);
      setResourceId("");
      setQueryParams({});
      setBody({});
      setResponse(null);
    }
  }, []);

  const buildUrl = useCallback((endpoint: ApiEndpoint): string => {
    let path = endpoint.path;
    
    // Replace {service} placeholder for health checks
    if (path.includes("{service}")) {
      path = path.replace("{service}", resourceId || "artists");
    }
    
    // Replace {id} placeholder
    if (path.includes("{id}")) {
      if (!resourceId) {
        throw new Error("Resource ID is required for this endpoint");
      }
      path = path.replace("{id}", resourceId);
    }

    const url = new URL(BASE_URL + path);
    
    // Add query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value.trim()) {
        url.searchParams.append(key, value);
      }
    });

    return url.toString();
  }, [resourceId, queryParams]);

  const sendRequest = useCallback(async () => {
    if (!selectedEndpoint) {
      toast.error("Please select an endpoint");
      return;
    }

    setIsLoading(true);
    setResponse(null);

    try {
      const url = buildUrl(selectedEndpoint);
      const startTime = Date.now();

      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      // Add body for POST, PUT, PATCH
      if (["POST", "PUT", "PATCH"].includes(selectedEndpoint.method)) {
        const bodyObj: Record<string, unknown> = {};
        
        // Process body fields
        Object.entries(body).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            // Try to parse as number or boolean if it looks like one
            let parsedValue: unknown = value;
            if (typeof value === "string") {
              const trimmed = value.trim();
              if (trimmed === "true") parsedValue = true;
              else if (trimmed === "false") parsedValue = false;
              else if (!isNaN(Number(trimmed)) && trimmed !== "") {
                parsedValue = Number(trimmed);
              } else {
                parsedValue = trimmed;
              }
            }
            bodyObj[key] = parsedValue;
          }
        });

        options.body = JSON.stringify(bodyObj);
      }

      const fetchResponse = await fetch(url, options);
      const endTime = Date.now();

      let responseData: unknown;
      const contentType = fetchResponse.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        responseData = await fetchResponse.json();
      } else {
        responseData = await fetchResponse.text();
      }

      const headers: Record<string, string> = {};
      fetchResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });

      setResponse({
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        data: responseData,
        headers,
        time: endTime - startTime,
      });

      if (fetchResponse.ok) {
        toast.success(`Request successful (${fetchResponse.status})`);
      } else {
        toast.error(`Request failed (${fetchResponse.status})`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Request failed: ${errorMessage}`);
      setResponse({
        status: 0,
        statusText: "Error",
        data: { error: errorMessage },
        headers: {},
        time: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedEndpoint, buildUrl, body]);

  const copyResponse = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      toast.success("Response copied to clipboard");
    }
  }, [response]);

  const clearResponse = useCallback(() => {
    setResponse(null);
  }, []);

  const menuBar = (
    <ApiTesterMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onShowAbout={() => setIsAboutDialogOpen(true)}
    />
  );

  if (!isWindowOpen) return null;

  return (
    <>
      {!isXpTheme && isForeground && menuBar}
      <WindowFrame
        title="API Tester"
        onClose={onClose}
        isForeground={isForeground}
        appId="api-tester"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={isXpTheme ? menuBar : undefined}
      >
        <div className="flex flex-col h-full bg-white">
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Configuration */}
            <div className="w-1/2 border-r border-gray-300 flex flex-col">
              <div className="p-4 border-b border-gray-300">
                <h2 className="text-sm font-bold mb-3">Request Configuration</h2>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="endpoint-select" className="text-xs">
                      Endpoint
                    </Label>
                    <Select
                      value={selectedEndpoint?.id || ""}
                      onValueChange={handleEndpointSelect}
                    >
                      <SelectTrigger id="endpoint-select" className="h-8 text-xs">
                        <SelectValue placeholder="Select an endpoint" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <div key={category}>
                            <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase">
                              {category}
                            </div>
                            {API_ENDPOINTS.filter((e) => e.category === category).map((endpoint) => (
                              <SelectItem key={endpoint.id} value={endpoint.id} className="text-xs">
                                {endpoint.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedEndpoint && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        {selectedEndpoint.description || `${selectedEndpoint.method} ${selectedEndpoint.path}`}
                      </p>
                    )}
                  </div>

                  {selectedEndpoint?.requiresId && (
                    <div>
                      <Label htmlFor="resource-id" className="text-xs">
                        Resource ID {selectedEndpoint.path.includes("{service}") ? "(Service Name)" : ""}
                      </Label>
                      <Input
                        id="resource-id"
                        value={resourceId}
                        onChange={(e) => setResourceId(e.target.value)}
                        placeholder={selectedEndpoint.path.includes("{service}") ? "e.g., artists" : "e.g., 1"}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}

                  {selectedEndpoint?.queryParams && selectedEndpoint.queryParams.length > 0 && (
                    <div>
                      <Label className="text-xs mb-2 block">Query Parameters</Label>
                      <div className="space-y-2">
                        {selectedEndpoint.queryParams.map((param) => (
                          <div key={param.name}>
                            <Label htmlFor={`query-${param.name}`} className="text-[10px]">
                              {param.name} {param.required && <span className="text-red-500">*</span>}
                            </Label>
                            <Input
                              id={`query-${param.name}`}
                              value={queryParams[param.name] || ""}
                              onChange={(e) =>
                                setQueryParams((prev) => ({
                                  ...prev,
                                  [param.name]: e.target.value,
                                }))
                              }
                              placeholder={param.description || param.name}
                              className="h-7 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedEndpoint?.bodyFields && selectedEndpoint.bodyFields.length > 0 && (
                    <div>
                      <Label className="text-xs mb-2 block">Request Body</Label>
                      <div className="space-y-2">
                        {selectedEndpoint.bodyFields.map((field) => (
                          <div key={field.name}>
                            <Label htmlFor={`body-${field.name}`} className="text-[10px]">
                              {field.name} ({field.type}) {field.required && <span className="text-red-500">*</span>}
                            </Label>
                            {field.type === "string" && field.name.includes("bio") || field.name.includes("description") ? (
                              <Textarea
                                id={`body-${field.name}`}
                                value={(body[field.name] as string) || ""}
                                onChange={(e) =>
                                  setBody((prev) => ({
                                    ...prev,
                                    [field.name]: e.target.value,
                                  }))
                                }
                                placeholder={field.description || field.name}
                                className="h-16 text-xs resize-none"
                              />
                            ) : (
                              <Input
                                id={`body-${field.name}`}
                                value={(body[field.name] as string) || ""}
                                onChange={(e) =>
                                  setBody((prev) => ({
                                    ...prev,
                                    [field.name]: e.target.value,
                                  }))
                                }
                                placeholder={field.description || field.name}
                                className="h-7 text-xs"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={sendRequest}
                  disabled={isLoading || !selectedEndpoint}
                  className="w-full mt-4 h-8 text-xs"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-2" />
                      Send Request
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right Panel - Response */}
            <div className="w-1/2 flex flex-col">
              <div className="p-4 border-b border-gray-300 flex items-center justify-between">
                <h2 className="text-sm font-bold">Response</h2>
                <div className="flex gap-2">
                  {response && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyResponse}
                        className="h-7 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearResponse}
                        className="h-7 text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4">
                  {!response ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <p className="text-xs">No response yet</p>
                      <p className="text-[10px] mt-1">Select an endpoint and click Send Request</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold">Status:</span>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded",
                              response.status >= 200 && response.status < 300
                                ? "bg-green-100 text-green-700"
                                : response.status >= 400
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            )}
                          >
                            {response.status} {response.statusText}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            ({response.time}ms)
                          </span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold mb-1 block">Response Body:</Label>
                        <pre className="text-[10px] bg-gray-50 p-2 rounded border border-gray-200 overflow-auto max-h-96">
                          {JSON.stringify(response.data, null, 2)}
                        </pre>
                      </div>

                      {Object.keys(response.headers).length > 0 && (
                        <div>
                          <Label className="text-xs font-semibold mb-1 block">Headers:</Label>
                          <pre className="text-[10px] bg-gray-50 p-2 rounded border border-gray-200 overflow-auto">
                            {JSON.stringify(response.headers, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <HelpDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          helpItems={helpItems}
          appId="api-tester"
        />
        <AboutDialog
          isOpen={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
          metadata={appMetadata}
          appId="api-tester"
        />
      </WindowFrame>
    </>
  );
}



