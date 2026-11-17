/**
 * Static brand assets restored under public/assets/. Wrapped with
 * encodeURI() since a couple of the original filenames contain spaces and
 * parentheses.
 */
export const assets = {
  logo: encodeURI("/assets/logo-arenan-kalikesek (sikesek).png"),
  // Transparent padding trimmed off the square source, for places that show
  // the wordmark on its own (e.g. the admin sidebar) without the artwork
  // shrinking into the middle of a 320x320 canvas.
  logoWide: "/assets/logo-arenan-kalikesek-wordmark.png",
  // Clean SIKESEK mark for internal surfaces (admin login, admin sidebar).
  logoInternal: "/assets/logo_sikesek.png",
  heroBackground: encodeURI(
    "/assets/green-trees-beside-river-during-daytime-clkl9_xcuis by usplash.jpg",
  ),
  homestayPhotos: {
    "AREN 1": "/assets/aren1.jpg",
    "AREN 2": "/assets/aren2.jpg",
    "AREN 3": "/assets/aren3.jpg",
    "AREN 4": "/assets/aren4.jpg",
  } as Record<string, string>,
};
