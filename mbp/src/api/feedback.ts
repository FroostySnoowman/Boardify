import { nativeFetch } from './http';

export async function submitBugReport(text: string): Promise<void> {
  await nativeFetch('/feedback/bug', {
    method: 'POST',
    data: { text: text.trim() },
    params: {},
  });
}

export async function submitSuggestion(text: string): Promise<void> {
  await nativeFetch('/feedback/suggestion', {
    method: 'POST',
    data: { text: text.trim() },
    params: {},
  });
}
