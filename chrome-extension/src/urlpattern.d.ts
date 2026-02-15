declare class URLPattern {
  constructor(input: string | { pathname?: string; hostname?: string; protocol?: string });
  test(input: string | URL): boolean;
}
