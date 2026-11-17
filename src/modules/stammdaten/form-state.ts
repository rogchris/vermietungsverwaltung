export type FormState = { message?: string; errors?: Record<string, string[] | undefined> };
export type MasterAction = (state: FormState, form: FormData) => Promise<FormState>;
