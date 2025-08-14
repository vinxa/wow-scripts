import os
from typing import List, Optional, Literal, TypedDict, Callable, Tuple, Dict
import asyncio
import discord
from discord.ext import commands
import gspread
import logging
from datetime import datetime, timedelta, timezone

logging.basicConfig(level=logging.INFO)

GOOGLE_SHEET_URL = (os.environ.get("GOOGLE_SHEET_URL"))
WORKSHEET_NAME = os.environ.get("WORKSHEET_NAME")
TOKEN = os.environ.get("DISCORD_TOKEN")
GUILD_IDS = os.environ.get("DISCORD_GUILD_IDS","")

## TYPES #########################################################################################
class Row(TypedDict, total=False):
    character: str
    spec: str
    date: str
    difficulty: str
    upgrade: str
    icy_veins: str
    wowhead: str
    boss: str

FieldFunc = Callable[[Row], Tuple[str, str]]  # returns (field_name, field_value)


## HELPERS #########################################################################################
def _parse_guild_ids() -> list[int]:
    ids = []
    for s in GUILD_IDS.split(","):
        s = s.strip()
        if s.isdigit():
            ids.append(int(s))
    return ids

def get_gspread_client() -> gspread.client.Client:
    cred_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    return gspread.service_account(filename=cred_file)

def _safe(s: str, fallback: str = "—") -> str:
    s = (s or "").strip()
    return s if s else fallback

def _format_date(s :str) -> str:
    s = (s or "").strip()
    if not s:
        return "—"
    try:
        dt = datetime.strptime(s, "%Y-%m-%dT%H:%M:%S.%fZ")
        return dt.strftime("%d %b  %H:%M")
    except ValueError:
        return s

def _format_upgrade(s: str) -> str:
    s = (s or "").replace(",", "").strip()
    if not s:
        return "—"
    try:
        f = float(s)
        if f.is_integer():
            return f"{int(f):,}"
        return f"{f:,}".rstrip("0").rstrip(".")
    except ValueError:
        return s

def _matches_difficulty(cell: str, wanted: Optional[str]) -> bool:
    if not wanted:
        return True
    return (cell or "").strip().lower() == wanted.strip().lower()

## SHEETS #########################################################################################
def _row_from_sheet(padded: List[str]) -> Row:
    return Row(
        character=padded[0],
        spec=padded[1],
        date=padded[2],
        difficulty=padded[3],
        boss=padded[4] if len(padded) > 4 else "",
        # Column 5 (index 5) is item, not stored here
        upgrade=padded[7] if len(padded) > 7 else "",
        icy_veins=padded[9] if len(padded) > 9 else "",
        wowhead=padded[10] if len(padded) > 10 else "",
    )


def find_matching_rows(
    worksheet: gspread.worksheet.Worksheet,
    item_name: str,
) -> List[Row]:
    all_values = worksheet.get_all_values()
    records = all_values[1:]
    results: List[Row] = []
    target = item_name.strip().lower()
    for row in records:
        padded = row + [""] * (12 - len(row))
        current_item = padded[5].strip().lower()
        if current_item == target:
            results.append(_row_from_sheet(padded))
    return results


def get_unique_bosses(worksheet: gspread.worksheet.Worksheet) -> List[str]:
    all_values = worksheet.get_all_values()
    records = all_values[1:]
    seen = set()
    bosses: List[str] = []
    for row in records:
        if len(row) <= 4:
            continue
        b = row[4].strip()
        if b and b not in seen:
            seen.add(b)
            bosses.append(b)
    return bosses


def find_rows_by_boss(
    worksheet: gspread.worksheet.Worksheet,
    boss_name: str,
    *,
    difficulty: Optional[str] = None,
) -> List[Row]:
    all_values = worksheet.get_all_values()
    records = all_values[1:]
    target = boss_name.strip().lower()
    results: List[Row] = []
    for row in records:
        padded = row + [""] * (12 - len(row))
        if len(padded) <= 4:
            continue
        current_boss = padded[4].strip().lower()
        if current_boss == target and _matches_difficulty(padded[3], difficulty):
            results.append(_row_from_sheet(padded))
    return results

def _links_line(r: Row) -> str:
    parts: List[str] = []
    if _safe(r.get("wowhead", "")):
        parts.append(f"[Wowhead]({_safe(r['wowhead'])})")
    if _safe(r.get("icy_veins", "")):
        parts.append(f"[Icy Veins]({_safe(r['icy_veins'])})")
    return " | ".join(parts)


def f_character_block(r: Row) -> Tuple[str, str]:
    name = _safe(r.get("character"), "Character")
    val = f"*{_safe(r.get('spec'), '—')}*\n{_format_date(_safe(r.get('date'), ''))}"
    return name, val


def f_character(r: Row) -> Tuple[str, str]:
    return "Character", _safe(r.get("character"))


def f_spec(r: Row) -> Tuple[str, str]:
    return "Spec", _safe(r.get("spec"))


def f_date(r: Row) -> Tuple[str, str]:
    return "Date", _format_date(_safe(r.get("date"), ""))


def f_difficulty(r: Row) -> Tuple[str, str]:
    return "Difficulty", _safe(r.get("difficulty"))


def f_upgrade(r: Row) -> Tuple[str, str]:
    return "Upgrade #", _format_upgrade(_safe(r.get("upgrade"), ""))


def f_upgrade_links(r: Row) -> Tuple[str, str]:
    up = _format_upgrade(_safe(r.get("upgrade"), ""))
    ln = _links_line(r)
    return "Upgrade #", (up + (f"\n{ln}" if ln else ""))


def f_links(r: Row) -> Tuple[str, str]:
    return "Links", _safe(_links_line(r))


def f_boss(r: Row) -> Tuple[str, str]:
    return "Boss", _safe(r.get("boss"))


FIELD_REGISTRY: Dict[str, FieldFunc] = {
    "character_block": f_character_block,
    "character": f_character,
    "spec": f_spec,
    "date": f_date,
    "difficulty": f_difficulty,
    "upgrade": f_upgrade,
    "upgrade_links": f_upgrade_links,
    "links": f_links,
    "boss": f_boss,
}


def fields_from_row(row: Row, schema: List[str]) -> List[Tuple[str, str]]:
    out: List[Tuple[str, str]] = []
    for key in schema:
        fn = FIELD_REGISTRY.get(key)
        if not fn:
            logging.warning("Unknown field key in schema: %s", key)
            continue
        name, value = fn(row)
        out.append((name[:256], value[:1024]))
    return out

## EMBEDS #########################################################################################
MAX_FIELDS_PER_EMBED = 25
def _row_to_fields(row: List[str], fields: List[str]) -> list[tuple[str, str]]:
    (char_name, spec_name, report_date, difficulty, upgrade_num, icy_veins, wowhead) = row

    links: list[str] = []
    if _safe(wowhead, ""):
        links.append(f"[Wowhead]({_safe(wowhead)})")
    if _safe(icy_veins, ""):
        links.append(f"[Icy Veins]({_safe(icy_veins)})")
    links_str = " | ".join(links)


    f1_name = _safe(char_name, "Character")
    f1_val = f"*{_safe(spec_name, '—')}*\n{_format_date(report_date)}"

    f2_name = "Difficulty"
    f2_val = _safe(difficulty)

    f3_name = "Upgrade #"
    f3_val = _format_upgrade(upgrade_num)
    if links_str:
        f3_val = f"{f3_val}\n{links_str}"

    return [(f1_name, f1_val), (f2_name, f2_val), (f3_name, f3_val)]

def build_embeds_from_rows(rows: List[Row], title: str, schema: List[str]) -> list[discord.Embed]:
    if not schema:
        raise ValueError("Schema must have at least one field key.")

    fields_per_row = len(schema)
    rows_per_embed = max(1, MAX_FIELDS_PER_EMBED // fields_per_row)

    embeds: list[discord.Embed] = []
    total_pages = (len(rows) + rows_per_embed - 1) // rows_per_embed if rows else 1

    for page_idx in range(total_pages):
        start = page_idx * rows_per_embed
        end = min(start + rows_per_embed, len(rows))
        page_rows = rows[start:end]

        embed = discord.Embed(title=title, color=discord.Color.blurple())
        if len(rows) > rows_per_embed:
            embed.set_footer(text=f"Page {page_idx + 1}/{total_pages}")

        for r in page_rows:
            for name, value in fields_from_row(r, schema):
                embed.add_field(name=name, value=value, inline=True)

        embeds.append(embed)

    if not embeds:
        embeds.append(discord.Embed(title=title, description="No results.", color=discord.Color.red()))

    return embeds

class PaginatedEmbeds(discord.ui.View):
    def __init__(self, embeds: list[discord.Embed], *, timeout: float = 180):
        super().__init__(timeout=timeout)
        self.embeds = embeds
        self.index = 0
        if len(embeds) <= 1:
            for child in self.children:
                if isinstance(child, discord.ui.Button):
                    child.disabled = True

    async def update(self, interaction: discord.Interaction):
        await interaction.response.edit_message(embed=self.embeds[self.index], view=self)

    @discord.ui.button(label="◀ Prev", style=discord.ButtonStyle.secondary)
    async def prev(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.index = (self.index - 1) % len(self.embeds)
        await self.update(interaction)

    @discord.ui.button(label="Next ▶", style=discord.ButtonStyle.secondary)
    async def next(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.index = (self.index + 1) % len(self.embeds)
        await self.update(interaction)


## BOT CTRL #########################################################################################
class BossPickerView(discord.ui.View):
    """Interactive dropdown that lists bosses and prints matching rows on selection."""
    def __init__(self, worksheet: gspread.worksheet.Worksheet, bosses: List[str], *, timeout: float = 120):
        super().__init__(timeout=timeout)
        self.worksheet = worksheet
        self.total = len(bosses)
        self.bosses = bosses[:25]

        options = [discord.SelectOption(label=b) for b in self.bosses]
        self.select = discord.ui.Select(
            placeholder="Choose a boss…",
            min_values=1,
            max_values=1,
            options=options,
        )
        self.select.callback = self._on_select  # bind callback dynamically
        self.add_item(self.select)

    async def _on_select(self, interaction: discord.Interaction):
        boss_name = self.select.values[0]
        await interaction.response.defer(thinking=True)
        results = await interaction.client.loop.run_in_executor(
            None, find_rows_by_boss, self.worksheet, boss_name
        )
        if not results:
            await interaction.followup.send(f"No rows found for boss '{boss_name}'.")
            return
        embeds = build_embeds_from_rows(results, title=f"Wishes for {boss_name}")
        view = PaginatedEmbeds(embeds)
        await interaction.followup.send(embed=embeds[0], view=view)

class LootCommands(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.gc = get_gspread_client()
        self.spreadsheet = self.gc.open_by_url(GOOGLE_SHEET_URL)
        self.worksheet = self.spreadsheet.worksheet(WORKSHEET_NAME)

        # Boss cache to avoid hitting Sheets on each keystroke
        self._boss_cache: List[str] = []
        self._boss_cache_at: Optional[datetime] = None
        self._boss_ttl = timedelta(minutes=10)


        # Per-command schemas (edit to taste)
        self.ITEM_SCHEMA_COMPACT = ["character_block", "difficulty", "upgrade_links"]
        self.ITEM_SCHEMA_WIDE = ["character", "spec", "date", "difficulty", "upgrade_links"]
        self.BOSS_SCHEMA = ["character_block", "difficulty", "upgrade_links"]

    # ---- cache helpers ----
    def _bosses_cached(self) -> bool:
        return self._boss_cache and self._boss_cache_at and (datetime.utcnow() - self._boss_cache_at) < self._boss_ttl

    async def _ensure_bosses(self):
        if self._bosses_cached():
            return
        loop = asyncio.get_running_loop()
        bosses = await loop.run_in_executor(None, get_unique_bosses, self.worksheet)
        bosses.sort(key=lambda s: s.lower())
        self._boss_cache = bosses[:1000]  # safety cap
        self._boss_cache_at = datetime.now(timezone.utc)

    # ---- autocomplete provider ----
    async def boss_autocomplete(self, interaction: discord.Interaction, current: str):
        await self._ensure_bosses()
        cur = (current or "").lower()
        # If user hasn't typed, show the first 25. Otherwise prefix/substring match.
        data = self._boss_cache
        if cur:
            data = [b for b in data if cur in b.lower()]
        # Discord allows max 25 choices
        return [discord.app_commands.Choice(name=b[:100], value=b) for b in data[:25]]

    @discord.app_commands.command(name="item", description="Look up an item and show matching rows.")
    @discord.app_commands.describe(
        item_name="Exact item name to look up.",
        difficulty="Optional difficulty filter",
        wide="Use wide layout (5 columns)",
    )
    async def item(
        self,
        interaction: discord.Interaction,
        item_name: str,
        difficulty: Optional[Literal["normal", "heroic", "mythic"]] = None,
        wide: Optional[bool] = False,
    ):
        await interaction.response.defer(thinking=True)
        results = await interaction.client.loop.run_in_executor(
            None, find_matching_rows, self.worksheet, item_name
        )
        if difficulty:
            results = [r for r in results if _matches_difficulty(r.get("difficulty", ""), difficulty)]

        if not results:
            msg = f"No results found for item '{item_name}'."
            if difficulty:
                msg += f" (difficulty: {difficulty})"
            await interaction.followup.send(msg)
            return

        schema = self.ITEM_SCHEMA_WIDE if wide else self.ITEM_SCHEMA_COMPACT
        title = f"Item: {item_name}" + (f" — {difficulty.title()}" if difficulty else "")
        embeds = build_embeds_from_rows(results, title=title, schema=schema)
        view = PaginatedEmbeds(embeds)
        await interaction.followup.send(embed=embeds[0], view=view)

    @discord.app_commands.command(name="boss", description="Show wishes for a boss (with autocomplete).")
    @discord.app_commands.describe(
        boss="Boss name (choose from suggestions)",
        difficulty="Optional difficulty filter",
        wide="Use wide layout (5 columns)",
    )
    @discord.app_commands.autocomplete(boss=boss_autocomplete)
    async def boss(
        self,
        interaction: discord.Interaction,
        boss: str,
        difficulty: Optional[Literal["normal", "heroic", "mythic"]] = None,
        wide: Optional[bool] = False,
    ):
        await interaction.response.defer(thinking=True)
        await self._ensure_bosses()
        if boss not in self._boss_cache:
            for b in self._boss_cache:
                if b.lower() == boss.lower():
                    boss = b
                    break
        results = await interaction.client.loop.run_in_executor(
            None, find_rows_by_boss, self.worksheet, boss, difficulty
        )
        if not results:
            msg = f"No rows found for boss '{boss}'."
            if difficulty:
                msg += f" (difficulty: {difficulty})"
            await interaction.followup.send(msg)
            return

        schema = self.ITEM_SCHEMA_WIDE if wide else self.BOSS_SCHEMA
        title = f"Wishes for {boss}" + (f" — {difficulty.title()}" if difficulty else "")
        embeds = build_embeds_from_rows(results, title=title, schema=schema)
        view = PaginatedEmbeds(embeds)
        await interaction.followup.send(embed=embeds[0], view=view)

class LootClient(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        super().__init__(command_prefix=commands.when_mentioned, intents=intents)
    async def setup_hook(self):
        await self.add_cog(LootCommands(self))
        logging.info("Loaded app commands: %s", [c.name for c in self.tree.get_commands()])
        guilds = _parse_guild_ids()
        if guilds:
            for gid in guilds:
                guild = discord.Object(id=gid)
                self.tree.copy_global_to(guild=guild)
                synced = await self.tree.sync(guild=guild)
                logging.info("Synced %d commands to guild %s", len(synced), gid)
        try:
            global_synced = await self.tree.sync()
            logging.info("Commands synced globally (%d commands)", len(global_synced))
        except Exception as e:
            logging.error("Error syncing Commands: %s", e)
    async def on_ready(self):
        print(f"Logged in as {self.user} (ID: {self.user.id})")
async def run_bot():
    if not TOKEN:
        raise RuntimeError("DISCORD_TOKEN not set")
    bot = LootClient()
    await bot.start(TOKEN)

if __name__ == "__main__":
    asyncio.run(run_bot())