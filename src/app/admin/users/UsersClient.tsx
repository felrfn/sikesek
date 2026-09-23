"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatShortDate } from "@/lib/utils/format";
import { createUser, resetUserPassword, updateUser } from "@/features/users/actions";
import type { User } from "@prisma/client";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UsersClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [activeUser, setActiveUser] = useState<User | null>(null);

  const filtered = useMemo(
    () =>
      users.filter((u) =>
        `${u.name} ${u.username} ${u.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [users, query],
  );

  if (mode === "create") {
    return (
      <UserForm
        mode="create"
        onCancel={() => setMode("list")}
        onSaved={() => {
          setMode("list");
          router.refresh();
        }}
      />
    );
  }

  if (mode === "edit" && activeUser) {
    return (
      <UserForm
        mode="edit"
        user={activeUser}
        onCancel={() => setMode("list")}
        onSaved={() => {
          setMode("list");
          router.refresh();
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          placeholder="Search staff by username or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((user) => (
          <Card key={user.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {initials(user.name)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
              <Badge tone={user.approvedAt ? "success" : "neutral"}>
                {user.approvedAt ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <p className="text-gray-400">Role</p>
              <p className="font-medium text-gray-700">{user.role}</p>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Joined {formatShortDate(user.createdAt)}
            </p>

            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const password = prompt(
                    `Enter a new password for ${user.name} (min 8 characters)`,
                  );
                  if (!password) return;
                  const form = new FormData();
                  form.set("password", password);
                  const result = await resetUserPassword(user.id, form);
                  if (result.error) alert(result.error);
                  else alert("Password reset.");
                }}
              >
                Reset
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setActiveUser(user);
                  setMode("edit");
                }}
              >
                Edit
              </Button>
            </div>
          </Card>
        ))}

        <button
          type="button"
          onClick={() => setMode("create")}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-6 text-gray-500 hover:border-brand-400 hover:text-brand-700"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
            <Plus className="size-5" />
          </div>
          Add New User
        </button>
      </div>
    </div>
  );
}

function UserForm({
  mode,
  user,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  user?: User;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result =
      mode === "create"
        ? await createUser(formData)
        : await updateUser(user!.id, formData);

    setIsSubmitting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <Card className="max-w-xl p-6">
      <h2 className="flex items-center gap-2 font-semibold text-gray-900">
        <UserPlus className="size-4 text-brand-700" />
        {mode === "create" ? "Add New User" : `Edit ${user?.name}`}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" name="name" defaultValue={user?.name} required />
          <Field
            label="Username"
            name="username"
            defaultValue={user?.username}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={user?.email}
            required
          />
          <Field label="Phone" name="phone" defaultValue={user?.phone ?? ""} />
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Role
          <select
            name="role"
            defaultValue={user?.role ?? "FIELD_OFFICER"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="ADMIN">Admin</option>
            <option value="FIELD_OFFICER">Field Officer</option>
          </select>
        </label>

        {mode === "create" ? (
          <Field label="Password" name="password" type="password" required />
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="approved"
              value="true"
              defaultChecked={Boolean(user?.approvedAt)}
            />
            Active (approved to log in)
          </label>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
