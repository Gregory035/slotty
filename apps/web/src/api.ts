export interface ApiHealth {
  status: 'ok';
  service: string;
  timestamp: string;
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await fetch(`${apiUrl}/health`);

  if (!response.ok) {
    throw new Error('API is unavailable');
  }

  return response.json() as Promise<ApiHealth>;
}
