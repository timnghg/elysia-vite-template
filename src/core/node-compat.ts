import { IncomingMessage, ServerResponse } from "http";

export function nodeCompat(
    req: Request,
    middleware: (
        req: IncomingMessage,
        res: ServerResponse,
        next: () => void
    ) => void
) {
    const nodeReq = ElysiaIncomingMessage.fromRequest(req);
    const nodeRes = ElysiaServerResponse.fromRequest(nodeReq);

    return new Promise((resolve) => {
        nodeRes.reply = (_resp: Response) => {
            const resp = new Response(
                nodeRes.statusCode === 304 ? null : _resp.body,
                {
                    status: nodeRes.statusCode,
                    statusText: nodeRes.statusMessage,
                    headers: nodeRes.getHeaders() as HeadersInit,
                }
            );
            resolve(resp);
        };

        return middleware(nodeReq, nodeRes, () => {
            resolve(undefined);
        });
    });
}

class ElysiaIncomingMessage extends IncomingMessage {
    originalUrl?: string;
    originalRequest?: Request;

    static fromRequest(request: Request) {
        let originalUrl = request.url;
        let url = request.url;

        // @todo: figure correct TS type for this
        const message = new ElysiaIncomingMessage({
            method: request.method,
            headers: request.headers as Record<string, any>,
            url,
            body: request.body,
        } as any);

        message.originalUrl = originalUrl;
        message.originalRequest = request;
        return message;
    }
}

class ElysiaServerResponse extends ServerResponse {
    declare req: ElysiaIncomingMessage;
    reply?: (resp: Response) => void;

    constructor(options: {
        req: ElysiaIncomingMessage;
        reply?: (resp: Response) => void;
    }) {
        super(options as any);
    }

    static fromRequest(
        request: ElysiaIncomingMessage,
        reply?: (resp: Response) => void
    ) {
        return new ElysiaServerResponse({
            req: request,
            reply(resp: Response) {
                return this.reply ? this.reply(resp) : reply?.(resp);
            },
        });
    }
}
