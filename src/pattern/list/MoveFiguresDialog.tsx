import React from "react";
import { useTranslation } from "react-i18next";
import AppDialog from "@/src/common/components/AppDialog";
import { ListRow } from "@/src/common/ui";

export interface MoveTarget {
  /** What `onSelect` hands back. */
  id: string;
  title: string;
  /** A colour pip for a type, say. */
  leading?: React.ReactNode;
}

interface MoveFiguresDialogProps {
  /** The name of what is being removed (a type, a level); undefined hides the dialog. */
  removing: string | undefined;
  /** How many figures use it. */
  count: number;
  targets: MoveTarget[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Asks where the figures of a type or level being removed in list settings go, with the others
 * (and for a level, "No level") as choices. Removing only happens on _Move and remove_.
 */
const MoveFiguresDialog: React.FC<MoveFiguresDialogProps> = ({
  removing,
  count,
  targets,
  selectedId,
  onSelect,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const name = removing ?? "";
  return (
    <AppDialog
      visible={removing !== undefined}
      title={t("moveTypeTitle", { type: name })}
      message={
        count === 1
          ? t("moveTypeMessageOne", { type: name })
          : t("moveTypeMessageMany", { count, type: name })
      }
      closeLabel={t("cancel")}
      onClose={onClose}
      confirmLabel={t("moveTypeConfirm")}
      confirmDestructive
      onConfirm={onConfirm}
    >
      {targets.map((target) => (
        <ListRow
          key={target.id}
          title={target.title}
          leading={target.leading}
          selection="single"
          selected={selectedId === target.id}
          onPress={() => onSelect(target.id)}
        />
      ))}
    </AppDialog>
  );
};

export default MoveFiguresDialog;
