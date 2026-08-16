import { ChevronDownIcon } from "lucide-react";

import { Button } from "./ui/button";
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "./ui/menu";

export interface HeaderFilterMenuOption<Value extends string> {
  value: Value;
  label: string;
}

export function HeaderFilterMenu<Value extends string>({
  label,
  value,
  options,
  onChange,
  align = "start",
  popupClassName,
}: {
  label: string;
  value: Value;
  options: ReadonlyArray<HeaderFilterMenuOption<Value>>;
  onChange: (value: Value) => void;
  align?: "start" | "center" | "end";
  popupClassName?: string;
}) {
  const current = options.find((option) => option.value === value) ?? options[0];
  if (!current) return null;
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button size="compact" variant="ghost-muted" aria-label={label} className="text-sm" />
        }
      >
        {current.label}
        <ChevronDownIcon aria-hidden className="size-3 text-muted-foreground/70" />
      </MenuTrigger>
      <MenuPopup align={align} side="bottom" className={popupClassName ?? "min-w-40"}>
        <MenuRadioGroup value={current.value} onValueChange={(next) => onChange(next as Value)}>
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
