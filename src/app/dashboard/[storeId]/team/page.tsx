import { ActionForm } from "@/components/action-form";
import { ConfirmButton, SubmitButton } from "@/components/form";
import { changeStaffRole, inviteStaff, removeStaffMember } from "@/lib/actions/team";
import { requireStore } from "@/lib/auth";
import { listStaff } from "@/lib/data";

export const metadata = { title: "Team" };

const ROLES = {
  manager: "Everything except payments, team and deleting the store",
  staff: "Orders, POS, inbox, products and customers",
};

export default async function TeamPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store, user } = await requireStore(storeId, "owner");
  const members = await listStaff(store.id);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-zinc-600">Give your staff their own login. They only see what their role allows.</p>
      </div>
      <div className="card divide-y divide-zinc-100">
        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <span>
            <span className="font-medium">{user.name}</span> <span className="text-zinc-500">({user.email})</span>
          </span>
          <span className="badge bg-zinc-900 text-white">owner</span>
        </div>
        {members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
            <span className="flex-1">
              {m.email}
              {!m.user_id && <span className="ml-2 badge bg-amber-100 text-amber-800 normal-case">invited — not signed up yet</span>}
            </span>
            <form action={changeStaffRole.bind(null, store.id, m.id)} className="flex gap-1">
              <select name="role" defaultValue={m.role} className="input py-1 text-xs" aria-label={`Role for ${m.email}`}>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
              <SubmitButton className="btn-secondary px-2 py-1 text-xs" pendingText="…">Save</SubmitButton>
            </form>
            <form action={removeStaffMember.bind(null, store.id, m.id)}>
              <ConfirmButton className="btn px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" message={`Remove ${m.email} from the team?`}>Remove</ConfirmButton>
            </form>
          </div>
        ))}
      </div>
      <ActionForm action={inviteStaff.bind(null, store.id)} className="card space-y-3 p-5">
        <h2 className="font-semibold">Add a team member</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <input name="email" type="email" className="input" placeholder="staff@example.com" required />
          <select name="role" className="input" defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <ul className="text-xs text-zinc-500">
          {Object.entries(ROLES).map(([r, d]) => (
            <li key={r}><span className="font-medium capitalize text-zinc-700">{r}:</span> {d}</li>
          ))}
        </ul>
        <SubmitButton>Add to team</SubmitButton>
      </ActionForm>
    </div>
  );
}
