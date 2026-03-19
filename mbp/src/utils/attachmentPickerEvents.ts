// Simple event emitter for attachment picker communication
type Listener = (uris: string[]) => void;

class AttachmentPickerEvents {
  private listeners: Listener[] = [];

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(uris: string[]) {
    this.listeners.forEach(listener => listener(uris));
  }
}

export const attachmentPickerEvents = new AttachmentPickerEvents();
