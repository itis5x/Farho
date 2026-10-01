import { logout } from "@/app/(auth)/actions";
import type { User } from "@/lib/types";

export function UserMenu({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right text-sm sm:block">
        <div className="font-medium">{user.name}</div>
        <div className="text-xs text-zinc-500">{user.email}</div>
      </div>
      <form action={logout}>
        <button className="btn-secondary px-3 py-1.5" type="submit">
          Log out
        </button>
      </form>
    </div>
  );
}
