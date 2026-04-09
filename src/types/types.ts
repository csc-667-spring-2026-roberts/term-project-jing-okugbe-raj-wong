export interface User {
    id: number;
    email: string;
    gravatar_url: string;
    created_at: Date;
}

export interface DbUser extends User {
    password_hash: string;
}