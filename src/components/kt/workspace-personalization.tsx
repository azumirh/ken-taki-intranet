import { UserProfileEditor } from "@/components/kt/user-profile-editor";

export function WorkspacePersonalization() {
  return (
    <div className="mb-4 flex justify-end">
      <UserProfileEditor buttonLabel="Editar meu perfil" />
    </div>
  );
}
