export type ProviderKey = "google_calendar" | "microsoft_calendar" | "hubspot" | "calendly";

export type ProviderConfig = {
  key: ProviderKey;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUriEnv: string; // absolute URL
  extraAuthParams?: Record<string, string>;
};

export const PROVIDERS: Record<ProviderKey, ProviderConfig> = {
  google_calendar: {
    key: "google_calendar",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    redirectUriEnv: "GOOGLE_OAUTH_REDIRECT_URI",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  microsoft_calendar: {
    key: "microsoft_calendar",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["offline_access", "Calendars.Read"],
    clientIdEnv: "MS_OAUTH_CLIENT_ID",
    clientSecretEnv: "MS_OAUTH_CLIENT_SECRET",
    redirectUriEnv: "MS_OAUTH_REDIRECT_URI",
  },
  hubspot: {
    key: "hubspot",
    authUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
    clientIdEnv: "HUBSPOT_OAUTH_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_OAUTH_CLIENT_SECRET",
    redirectUriEnv: "HUBSPOT_OAUTH_REDIRECT_URI",
  },
  calendly: {
    key: "calendly",
    authUrl: "https://auth.calendly.com/oauth/authorize",
    tokenUrl: "https://auth.calendly.com/oauth/token",
    scopes: ["default"],
    clientIdEnv: "CALENDLY_OAUTH_CLIENT_ID",
    clientSecretEnv: "CALENDLY_OAUTH_CLIENT_SECRET",
    redirectUriEnv: "CALENDLY_OAUTH_REDIRECT_URI",
  },
};