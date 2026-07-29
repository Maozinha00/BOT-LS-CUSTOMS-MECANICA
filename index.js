import { CargoKey, HIERARQUIA_ORDEM } from "./types";

// Detecta a categoria com base no nome do cargo no Discord
export function identificarCargoPorNomeDiscord(nomeCargo: string): CargoKey | null {
  const norm = nomeCargo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (
    norm.includes("lider") || norm.includes("líder") || norm.includes("01") ||
    norm.includes("dono") || norm.includes("chefe") || norm.includes("boss") ||
    norm.includes("fundador") || norm.includes("comando") || norm.includes("lideranca")
  ) {
    return "Lider";
  }

  if (
    norm.includes("gerent") || norm.includes("gerenc") || norm.includes("02") ||
    norm.includes("03") || norm.includes("sublider") || norm.includes("coord") ||
    norm.includes("supervis")
  ) {
    return "Gerente";
  }

  if (
    norm.includes("elite") || norm.includes("veteran") || norm.includes("capitao") ||
    norm.includes("04") || norm.includes("destaque")
  ) {
    return "Elite";
  }

  if (
    norm.includes("recruta") || norm.includes("novato") || norm.includes("iniciante") ||
    norm.includes("06") || norm.includes("07") || norm.includes("08") ||
    norm.includes("teste") || norm.includes("estagi")
  ) {
    return "Recruta";
  }

  if (
    norm.includes("membro") || norm.includes("integrante") || norm.includes("05") ||
    norm.includes("faccionado") || norm.includes("soldado") || norm.includes("operacional")
  ) {
    return "membros";
  }

  return null;
}

// Mapeia todos os cargos do servidor por ordem de hierarquia no Discord
export function mapearCargosDaGuilda(guild: any): Map<string, CargoKey> {
  const map = new Map<string, CargoKey>();
  if (!guild || !guild.roles || !guild.roles.cache) return map;

  const rolesSorted = Array.from(guild.roles.cache.values())
    .filter((r: any) => r.name !== "@everyone" && !r.managed)
    .sort((a: any, b: any) => b.position - a.position);

  let currentInferredCargo: CargoKey | null = null;

  for (const role of rolesSorted as any[]) {
    const matched = identificarCargoPorNomeDiscord(role.name || "");
    if (matched) {
      map.set(role.id, matched);
      currentInferredCargo = matched;
    } else if (currentInferredCargo) {
      map.set(role.id, currentInferredCargo);
    }
  }

  return map;
}

// Obtém o cargo principal e a posição da hierarquia do membro
export function obterCargosDiscordMember(member: any, guildRoleMap?: Map<string, CargoKey>) {
  if (!member || !member.roles || !member.roles.cache) return { cargoPrincipal: null, temElite: false, rolePosition: 0 };

  let cargoPrincipal: CargoKey | null = null;
  let temElite = false;
  let highestRolePos = 0;

  const rolesOrdenadas = Array.from(member.roles.cache.values())
    .filter((r: any) => r.name !== "@everyone")
    .sort((a: any, b: any) => b.position - a.position);

  for (const role of rolesOrdenadas as any[]) {
    const match = (guildRoleMap && guildRoleMap.get(role.id)) || identificarCargoPorNomeDiscord(role.name || "");
    if (match === "Elite") temElite = true;

    if (match && !cargoPrincipal) {
      cargoPrincipal = match;
      highestRolePos = role.position;
    }
  }

  return { cargoPrincipal, temElite, rolePosition: highestRolePos };
}
