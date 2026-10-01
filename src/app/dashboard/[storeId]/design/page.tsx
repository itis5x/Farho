import { DesignEditor } from "./editor";
import { requireStore } from "@/lib/auth";

export const metadata = { title: "Website design" };

export default async function DesignPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Website design</h1>
        <p className="text-sm text-zinc-600">Customise how your store looks. Save to see changes in the live preview.</p>
      </div>
      <DesignEditor store={store} />
    </div>
  );
}
