export type WikiResponse = {
    body?: string;
    success?: boolean;
    message?: string;
}

export type PostsResponse = {
    id: number;
    file_url: string | null;
    large_file_url: string | null;
    preview_file_url: string | null;
    media_asset: {
        duration: number | null;
    }
}
