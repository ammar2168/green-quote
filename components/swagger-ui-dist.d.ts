/** The one entry point `ApiReference` loads; the package ships no types. */
declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  const SwaggerUI: (options: Record<string, unknown>) => unknown;

  export default SwaggerUI;
}
