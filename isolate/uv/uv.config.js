/* NULL · uv.config.js
   The settings the Ultraviolet service worker and the page agree on. The
   prefix has to stay inside the worker's scope (/uv/), which is why the
   rewritten sites all live under /uv/service/.

   `xor` is the codec: the frame's src is the target address put through
   Ultraviolet.codec.xor.encode, and the worker decodes it the same way. */

/*global Ultraviolet*/
self.__uv$config = {
  prefix: "/uv/service/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/uv/uv.handler.js",
  client: "/uv/uv.client.js",
  bundle: "/uv/uv.bundle.js",
  config: "/uv/uv.config.js",
  sw: "/uv/uv.sw.js",
};
