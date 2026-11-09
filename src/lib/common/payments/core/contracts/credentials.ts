import { z } from 'zod';

export interface FieldMeta {
  label: string;
  help?: string;
  secret?: boolean;
  placeholder?: string;
}

export interface CredentialField extends FieldMeta {
  key: string;
  secret: boolean;
}

export interface CredentialModule<I extends z.ZodObject = z.ZodObject, R extends z.ZodObject = z.ZodObject> {
  input: I;                                                      // what a human types — the form uses this schema
  runtime: R;                                                    // what the adapter needs; equals input when no generated keys
  fields: Record<string, FieldMeta>;
  generated: string[];                                           // runtime keys − input keys (server-created)
  inputFields: CredentialField[];                                // fields in input-schema order, for forms
  displayHint: (c: z.infer<R>) => string;
}

export function defineCredentials<I extends z.ZodObject, R extends z.ZodObject = I>(module: {
  input: I;
  runtime?: R;
  fields: { [K in keyof z.infer<I>]: FieldMeta };
  displayHint: (c: z.infer<R>) => string;
}): CredentialModule<I, R> {
  const runtime = (module.runtime ?? module.input) as unknown as R;
  const inputKeys = Object.keys(module.input.shape);
  const runtimeKeys = new Set(Object.keys(runtime.shape));

  for (const key of inputKeys) {
    if (!runtimeKeys.has(key)) {
      throw new Error(`credentials: input key "${key}" missing from runtime schema`);
    }
  }
  for (const key of Object.keys(module.fields)) {
    if (!inputKeys.includes(key)) {
      throw new Error(`credentials: field meta for unknown input key "${key}"`);
    }
  }

  const generated = [...runtimeKeys].filter((k) => !inputKeys.includes(k));
  const inputFields: CredentialField[] = inputKeys.map((key) => ({
    key,
    secret: false,
    ...module.fields[key],
  }));

  return {
    input: module.input,
    runtime,
    fields: module.fields as Record<string, FieldMeta>,
    generated,
    inputFields,
    displayHint: module.displayHint,
  };
}
