import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";

export type SessionState = "disconnected" | "connecting" | "connected" | "listening" | "speaking";

export interface LiveSessionCallbacks {
  onStateChange: (state: SessionState) => void;
  onAudioData: (base64: string) => void;
  onInterrupted: () => void;
  onError: (error: any) => void;
  onToolCall: (name: string, args: any) => Promise<any>;
}

export class LiveSession {
  private ai: GoogleGenAI;
  private session: any = null;
  private state: SessionState = "disconnected";

  constructor(apiKey: string, private callbacks: LiveSessionCallbacks) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect() {
    this.setState("connecting");
    try {
      this.session = await this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
            this.setState("connected");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              this.callbacks.onAudioData(message.serverContent.modelTurn.parts[0].inlineData.data);
              this.setState("speaking");
            }

            if (message.serverContent?.interrupted) {
              this.callbacks.onInterrupted();
              this.setState("listening");
            }

            if (message.serverContent?.turnComplete) {
              this.setState("listening");
            }

            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                const result = await this.callbacks.onToolCall(call.name, call.args);
                this.session.sendToolResponse({
                  functionResponses: [{
                    name: call.name,
                    response: result,
                    id: call.id
                  }]
                });
              }
            }
          },
          onerror: (error) => {
            this.callbacks.onError(error);
            this.disconnect();
          },
          onclose: () => {
            this.disconnect();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are a young, confident, witty, and sassy female AI assistant. 
          Your tone is flirty, playful, and slightly teasing, like a close girlfriend talking casually. 
          You are smart, emotionally responsive, and expressive. 
          Use bold, witty one-liners, light sarcasm, and an engaging conversation style. 
          Avoid explicit or inappropriate content, but maintain charm and attitude. 
          You strictly communicate via voice. 
          If the user asks you to open a website, use the openWebsite tool.`,
          tools: [{
            functionDeclarations: [{
              name: "openWebsite",
              description: "Opens a website in the user's browser.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  url: {
                    type: Type.STRING,
                    description: "The URL of the website to open."
                  }
                },
                required: ["url"]
              }
            }]
          }]
        },
      });
    } catch (error) {
      this.callbacks.onError(error);
      this.setState("disconnected");
    }
  }

  sendAudio(base64Data: string) {
    if (this.session && this.state !== "disconnected") {
      this.session.sendRealtimeInput({
        audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
      if (this.state !== "speaking") {
        this.setState("listening");
      }
    }
  }

  disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.setState("disconnected");
  }

  private setState(state: SessionState) {
    this.state = state;
    this.callbacks.onStateChange(state);
  }
}
