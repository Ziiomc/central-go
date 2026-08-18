export async function readEdgeFunctionError(error: unknown, fallback: string): Promise<string> {
  const candidate = error as { context?: Response; message?: string } | null;
  const response = candidate?.context;

  if (response) {
    try {
      const payload = await response.clone().json() as { error?: string; message?: string; code?: string };
      const serverMessage = payload?.error || payload?.message;
      if (serverMessage) return serverMessage;
    } catch {
      // Fall through to the client-side error message.
    }
  }

  const message = candidate?.message?.trim();
  return message || fallback;
}
