import type { RealtimeChannel } from '@supabase/supabase-js';
import { requireSupabase } from './supabase';

export const RADIO_VOICE_EVENT = 'radio-voice';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface RadioVoiceFrameMeta {
  streamId: string;
  sequence: number;
  sentAt: number;
  mimeType: string;
  targetDriverId: string | null;
}

export interface DecodedRadioVoiceFrame {
  meta: RadioVoiceFrameMeta;
  audio: ArrayBuffer;
}

export const radioTopic = (companyId: string) => `centralgo-radio:${companyId}`;

export const createPrivateRadioChannel = (companyId: string): RealtimeChannel => requireSupabase().channel(
  radioTopic(companyId),
  { config: { private: true, broadcast: { ack: true } } },
);

const asArrayBuffer = (value: unknown): ArrayBuffer | null => {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
  }
  return null;
};

export const encodeRadioVoiceFrame = (meta: RadioVoiceFrameMeta, audio: ArrayBuffer): ArrayBuffer => {
  const metadata = textEncoder.encode(JSON.stringify(meta));
  const output = new Uint8Array(4 + metadata.byteLength + audio.byteLength);
  new DataView(output.buffer).setUint32(0, metadata.byteLength, false);
  output.set(metadata, 4);
  output.set(new Uint8Array(audio), 4 + metadata.byteLength);
  return output.buffer;
};

export const decodeRadioVoiceFrame = (payload: unknown): DecodedRadioVoiceFrame | null => {
  const source = asArrayBuffer(payload);
  if (!source || source.byteLength < 5) return null;
  const metadataLength = new DataView(source).getUint32(0, false);
  if (metadataLength <= 0 || metadataLength > source.byteLength - 4) return null;
  try {
    const metadataBytes = new Uint8Array(source, 4, metadataLength);
    const meta = JSON.parse(textDecoder.decode(metadataBytes)) as RadioVoiceFrameMeta;
    if (!meta.streamId || !Number.isFinite(meta.sequence) || !meta.mimeType) return null;
    return {
      meta,
      audio: source.slice(4 + metadataLength),
    };
  } catch {
    return null;
  }
};

export const sendRadioVoiceFrame = async (
  channel: RealtimeChannel,
  meta: RadioVoiceFrameMeta,
  audio: ArrayBuffer,
): Promise<void> => {
  const result = await channel.send({
    type: 'broadcast',
    event: RADIO_VOICE_EVENT,
    payload: encodeRadioVoiceFrame(meta, audio),
  });
  if (result !== 'ok') throw new Error('La transmisión de radio perdió conexión. Inténtalo nuevamente.');
};
