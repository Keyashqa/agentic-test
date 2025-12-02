/**
 * Environment-based configuration for Next.js API endpoints
 * Handles both local development and cloud deployment contexts
 */

export interface EndpointConfig {
  backendUrl: string;
  agentEngineUrl?: string;
  environment: "local" | "cloud";
  deploymentType: "local" | "agent_engine" | "cloud_run";
}

/**
 * Detects the current deployment environment based on available environment variables
 */
function detectEnvironment(): EndpointConfig["environment"] {
  if (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.K_SERVICE ||
    process.env.FUNCTION_NAME
  ) {
    return "cloud";
  }
  return "local";
}

/**
 * Detects the deployment type based on environment variables
 */
function detectDeploymentType(): EndpointConfig["deploymentType"] {
  if (process.env.AGENT_ENGINE_ENDPOINT) return "agent_engine";
  if (process.env.K_SERVICE || process.env.CLOUD_RUN_SERVICE) return "cloud_run";
  return "local";
}

/**
 * Gets the backend URL based on deployment context
 */
function getBackendUrl(): string {
  const deploymentType = detectDeploymentType();

  switch (deploymentType) {
    case "agent_engine":
      if (process.env.AGENT_ENGINE_ENDPOINT) {
        return process.env.AGENT_ENGINE_ENDPOINT;
      }
      throw new Error("AGENT_ENGINE_ENDPOINT must be set for Agent Engine deployment");

    case "cloud_run":
      if (process.env.CLOUD_RUN_SERVICE_URL) {
        return process.env.CLOUD_RUN_SERVICE_URL;
      }
      break;

    default:
      return process.env.BACKEND_URL || "http://127.0.0.1:8000";
  }

  return process.env.BACKEND_URL || "http://127.0.0.1:8000";
}

/**
 * Gets the Agent Engine URL for direct Agent Engine API calls
 */
function getAgentEngineUrl(): string | undefined {
  return process.env.AGENT_ENGINE_ENDPOINT || undefined;
}

/**
 * Creates the endpoint configuration based on current environment
 */
export function createEndpointConfig(): EndpointConfig {
  const environment = detectEnvironment();
  const deploymentType = detectDeploymentType();

  const config: EndpointConfig = {
    backendUrl: getBackendUrl(),
    agentEngineUrl: getAgentEngineUrl(),
    environment,
    deploymentType,
  };

  if (process.env.NODE_ENV === "development") {
    console.log("🔧 Endpoint Configuration:", config);
  }

  return config;
}

/**
 * Current endpoint configuration
 */
export const endpointConfig = createEndpointConfig();

/**
 * Utility function to get authentication headers
 * Uses Workload Identity Federation (no JSON keys needed)
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Only add auth when talking to Agent Engine
  if (endpointConfig.deploymentType === "agent_engine") {
    try {
      const { GoogleAuth } = await import("google-auth-library");

      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });

      // Google automatically uses Workload Identity Federation
      const authClient = await auth.getClient();
      const accessToken = await authClient.getAccessToken();

      if (accessToken?.token) {
        headers["Authorization"] = `Bearer ${accessToken.token}`;
      }
    } catch (error) {
      console.error("Failed to get Google Cloud access token via WIF:", error);
      throw new Error("Authentication failed");
    }
  }

  return headers;
}

/**
 * Determines if we should use Agent Engine API directly
 */
export function shouldUseAgentEngine(): boolean {
  return (
    endpointConfig.deploymentType === "agent_engine" &&
    Boolean(endpointConfig.agentEngineUrl)
  );
}

export type AgentEngineEndpointType = "query" | "streamQuery" | "sessions";

/**
 * Gets the Agent Engine sessions API base URL (v1beta1)
 */
function getAgentEngineSessionsUrl(): string | undefined {
  if (!endpointConfig.agentEngineUrl) return undefined;

  const urlParts = endpointConfig.agentEngineUrl.match(
    /^(https:\/\/[^\/]+)\/v1\/(projects\/[^\/]+\/locations\/[^\/]+\/reasoningEngines\/[^\/]+)/
  );

  if (!urlParts) return undefined;

  const [, baseUrl, projectPath] = urlParts;
  return `${baseUrl}/v1beta1/${projectPath}`;
}

/**
 * Gets the appropriate endpoint for a given API path and operation type
 */
export function getEndpointForPath(
  path: string,
  endpointType: AgentEngineEndpointType = "streamQuery"
): string {
  if (shouldUseAgentEngine()) {
    if (endpointType === "streamQuery") {
      return `${endpointConfig.agentEngineUrl}:streamQuery`;
    } else if (endpointType === "query") {
      return `${endpointConfig.agentEngineUrl}:query`;
    } else if (endpointType === "sessions") {
      const sessionsUrl = getAgentEngineSessionsUrl();
      if (!sessionsUrl) {
        throw new Error("Could not construct sessions API URL");
      }
      return `${sessionsUrl}/sessions${path}`;
    }
  }

  return `${endpointConfig.backendUrl}${path}`;
}

/**
 * Gets the Agent Engine streaming endpoint
 */
export function getAgentEngineStreamEndpoint(): string {
  return getEndpointForPath("", "streamQuery");
}
