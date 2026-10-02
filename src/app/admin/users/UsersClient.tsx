"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
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
  const [generatedPasswordFor, setGeneratedPasswordFor] = useState<{
    name: string;
    password: string;
  } | null>(null);

  const filtered = useMemo(
    () =>
      users.filter((u) =>
        `${u.name} ${u.username} ${u.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [users, query],
  );

  async function handleReset(user: User) {
    if (!confirm(`Reset password for ${user.name}? A new random password will be generated.`)) {
      return;
    }
    const result = await resetUserPassword(user.id);
    if (result.error) {
      alert(result.error);
      return;
    }
    if (result.password) {
      setGeneratedPasswordFor({ name: user.name, password: result.password });
    }
  }

  const body =
    mode === "create" ? (
      <UserForm
        mode="create"
        onCancel={() => setMode("list")}
        onSaved={(generatedPassword, name) => {
          setMode("list");
          if (generatedPassword) setGeneratedPasswordFor({ name, password: generatedPassword });
          router.refresh();
        }}
      />
    ) : mode === "edit" && activeUser ? (
      <UserForm
        mode="edit"
        user={activeUser}
        onCancel={() => setMode("list")}
        onSaved={() => {
          setMode("list");
          router.refresh();
        }}
      />
    ) : (
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
              {user.mustChangePassword ? (
                <p className="mt-2 text-xs font-medium text-amber-600">
                  Must change password on next login
                </p>
              ) : null}

              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleReset(user)}>
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

  return (
    <>
      {body}
      <GeneratedPasswordModal
        value={generatedPasswordFor}
        onClose={() => setGeneratedPasswordFor(null)}
      />
    </>
  );
}

/**
 * Shown exactly once right after an account is created or reset (section:
 * user management - admins never choose a password, only see a generated
 * one long enough to copy it). There is no way to retrieve this value again
 * once the modal is closed - only `resetUserPassword` can issue a new one.
 */
function GeneratedPasswordModal({
  value,
  onClose,
}: {
  value: { name: string; password: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal open={value !== null} onClose={onClose} title="Password Generated">
      {value ? (
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            A random password was generated for <strong>{value.name}</strong>. Share it
            securely - it will not be shown again. They must change it on first login.
          </p>
          <div className="flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-base">
            {value.password}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(value.password).catch(() => {});
                setCopied(true);
              }}
              className="flex items-center gap-1 rounded-md bg-brand-700 px-2 py-1 text-xs font-medium text-white hover:bg-brand-800"
            >
              <Copy className="size-3.5" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
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
  onSaved: (generatedPassword: string | undefined, name: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    let generatedPassword: string | undefined;
    let actionError: string | undefined;

    if (mode === "create") {
      const result = await createUser(formData);
      actionError = result.error;
      generatedPassword = result.password;
    } else {
      const result = await updateUser(user!.id, formData);
      actionError = result.error;
    }

    setIsSubmitting(false);
    if (actionError) {
      setError(actionError);
      return;
    }
    onSaved(generatedPassword, String(formData.get("name") ?? ""));
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
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            A random password will be generated automatically and shown once after saving.
            The user must change it on first login.
          </p>
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
