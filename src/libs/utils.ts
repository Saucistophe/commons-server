import { Header, Transaction } from '@mockoon/commons';
import { Request, Response } from 'express';
import { SafeString } from 'handlebars';
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';
import { isAbsolute, resolve } from 'path';
import { URL } from 'url';
import { brotliDecompressSync, inflateSync, unzipSync } from 'zlib';

/**
 * Transform http headers objects to Mockoon's Header key value object
 *
 * @param object
 */
const TransformHeaders = (
  headers: IncomingHttpHeaders | OutgoingHttpHeaders
): Header[] =>
  Object.keys(headers).reduce<Header[]>((newHeaders, key) => {
    const headerValue = headers[key];
    let value = '';

    if (headerValue !== undefined) {
      if (Array.isArray(headerValue)) {
        value = headerValue.join(',');
      } else {
        value = headerValue.toString();
      }
    }

    newHeaders.push({ key, value });

    return newHeaders;
  }, []);

/**
 * Sort by ascending order
 *
 * @param a
 * @param b
 */
const AscSort = (a, b) => {
  if (a.key < b.key) {
    return -1;
  } else {
    return 1;
  }
};

/**
 * Check if an Object or Array is empty
 *
 * @param obj
 */
export const IsEmpty = (obj) =>
  [Object, Array].includes((obj || {}).constructor) &&
  !Object.entries(obj || {}).length;

/**
 * Return a random integer
 *
 * @param a
 * @param b
 */
export const RandomInt = (a = 1, b = 0) => {
  const lower = Math.ceil(Math.min(a, b));
  const upper = Math.floor(Math.max(a, b));

  return Math.floor(lower + Math.random() * (upper - lower + 1));
};

/**
 * Decompress body based on content-encoding
 *
 * @param response
 */
export const DecompressBody = (response: Response) => {
  if (!response.body) {
    return response.body;
  }

  const contentEncoding = response.getHeader('content-encoding');
  let body = response.body;
  switch (contentEncoding) {
    case 'gzip':
      body = unzipSync(body);
      break;
    case 'br':
      body = brotliDecompressSync(body);
      break;
    case 'deflate':
      body = inflateSync(body);
      break;
    default:
      break;
  }

  return body.toString('utf-8');
};

/**
 * Create a Transaction object from express req/res.
 * To be used after the response closes
 *
 * @param request
 * @param response
 */
export const CreateTransaction = (
  request: Request,
  response: Response
): Transaction => ({
  request: {
    method: request.method,
    urlPath: new URL(request.originalUrl, 'http://localhost/').pathname,
    route: request.route ? request.route.path : null,
    params: request.params
      ? Object.keys(request.params).map((paramName) => ({
          name: paramName,
          value: request.params[paramName]
        }))
      : [],
    queryParams: request.query
      ? Object.keys(request.query).map((queryParamName) => ({
          name: queryParamName,
          value: request.query[queryParamName] as string
        }))
      : [],
    body: request.body,
    headers: TransformHeaders(request.headers).sort(AscSort)
  },
  response: {
    statusCode: response.statusCode,
    headers: TransformHeaders(response.getHeaders()).sort(AscSort),
    body: DecompressBody(response)
  },
  routeResponseUUID: response.routeResponseUUID,
  routeUUID: response.routeUUID,
  proxied: request.proxied || false
});

/**
 * Convert a string to base64
 *
 * @param text
 */
export const ToBase64 = (text: string): string => {
  if (typeof btoa === 'function') {
    return btoa(text);
  }

  if (typeof Buffer === 'function') {
    return Buffer.from(text).toString('base64');
  }

  return text;
};

/**
 * Convert a SafeString to a string if needed.
 *
 * @param text
 * @returns
 */
export const fromSafeString = (text: string | SafeString) =>
  text instanceof SafeString ? text.toString() : text;

/**
 * Resolve a file path relatively to the current environment folder if provided
 */
export const resolvePathFromEnvironment = (
  filePath: string,
  environmentDirectory?: string
) => {
  if (environmentDirectory && !isAbsolute(filePath)) {
    return resolve(environmentDirectory, filePath);
  }

  return filePath;
};
