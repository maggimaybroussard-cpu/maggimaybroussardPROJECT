const ENDPOINT = '/api/ai/speech-to-text';

export async function speechToText(
  provider: string,
  model: string,
  file: Blob | File,
  parameters: object = {}
) {
  const formData = new FormData();
  formData.append('provider', provider);
  formData.append('model', model);
  formData.append('parameters', JSON.stringify(parameters));
  formData.append('file', file);

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    body: formData,
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
}
