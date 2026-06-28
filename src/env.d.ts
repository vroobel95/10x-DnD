declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}

declare module "*.bin" {
  const content: ArrayBuffer;
  export default content;
}
