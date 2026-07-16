export async function callAIEndpoint(endpoint: string, payload: object) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('API Route Error:', {
        error: data.error,
        details: data.details,
      });
      throw new Error(data.error || `Request failed: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}
