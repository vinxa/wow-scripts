import os
from typing import List, Optional, Literal
import asyncio
import discord
from discord.ext import commands
import gspread
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)

GOOGLE_SHEET_URL = (os.environ.get("GOOGLE_SHEET_URL"))
WORKSHEET_NAME = os.environ.get("WORKSHEET_NAME")
TOKEN = os.environ.get("DISCORD_TOKEN")
GUILD_IDS = os.environ.get("DISCORD_GUILD_IDS","")

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
        dt = datetime.strptime("%Y-%m-%dT%H:%M:%S.%fZ")
        return dt.strftime("%o %b  %H:%M")
    except ValueError:
        return s

## SHEETS #########################################################################################
def _matches_difficulty(cell: str, wanted: Optional[str]) -> bool:
    if not wanted:
        return True
    return (cell or "").strip().lower() == wanted.strip().lower()

def find_matching_rows(
    worksheet: gspread.worksheet.Worksheet, item_name: str, difficulty: Optional[str] = None) -> List[List[str]]:
    all_values = worksheet.get_all_values()
    records = all_values[1:]  # Skip header
    results: List[List[str]] = []
    target = item_name.strip().lower()
    for row in records:
        padded_row = row + [""] * (11 - len(row))
        current_item = padded_row[5].strip().lower()
        if current_item == target and _matches_difficulty(padded_row[3],difficulty):
            char_name = padded_row[0]
            spec_name = padded_row[1]
            report_date = padded_row[2]
            difficulty = padded_row[3]
            upgrade_num = padded_row[7] if len(padded_row) > 7 else ""
            icy_veins = padded_row[9] if len(padded_row) > 9 else ""
            wowhead = padded_row[10] if len(padded_row) > 10 else ""
            results.append(
                [char_name, spec_name, report_date, difficulty, upgrade_num, icy_veins, wowhead]
            )
    return results

def get_unique_bosses(worksheet: gspread.worksheet.Worksheet) -> List[str]:
    all_values = worksheet.get_all_values()
    records = all_values[1:]  # skip header
    seen = set()
    bosses: List[str] = []
    for row in records:
        b = row[4].strip()
        if b and b not in seen:
            seen.add(b)
            bosses.append(b)
    return bosses

def find_rows_by_boss(
    worksheet: gspread.worksheet.Worksheet, boss_name: str
) -> List[List[str]]:
    """Return rows whose Column E (index 4) equals boss_name (case-insensitive)."""
    all_values = worksheet.get_all_values()
    records = all_values[1:]
    target = boss_name.strip().lower()
    results: List[List[str]] = []
    for row in records:
        padded_row = row + [""] * (11 - len(row))
        current_boss = padded_row[4].strip().lower()
        if current_boss == target:
            char_name = padded_row[0]
            spec_name = padded_row[1]
            report_date = padded_row[2]
            difficulty = padded_row[3]
            upgrade_num = padded_row[7] if len(padded_row) > 7 else ""
            icy_veins = padded_row[9] if len(padded_row) > 9 else ""
            wowhead = padded_row[10] if len(padded_row) > 10 else ""
            results.append(
                [char_name, spec_name, report_date, difficulty, upgrade_num, icy_veins, wowhead]
            )
    return results


## EMBEDS #########################################################################################
MAX_FIELDS_PER_EMBED = 25
def _row_to_three_inline_fields(row: List[str]) -> list[tuple[str, str]]:
    """Pack a single result row into THREE inline fields for a Discord embed.
    Returns a list of (name, value) pairs.
    Layout (3 inline fields):
    1) Character  -> "*Spec*\nDate"
    2) Difficulty -> value
    3) Upgrade #  -> value plus links
    """
    (char_name, spec_name, report_date, difficulty, upgrade_num, icy_veins, wowhead) = row

    links: list[str] = []
    if _safe(wowhead, ""):
        links.append(f"[Wowhead]({_safe(wowhead)})")
    if _safe(icy_veins, ""):
        links.append(f"[Icy Veins]({_safe(icy_veins)})")
    links_str = " | ".join(links)

    f1_name = _safe(char_name, "Character")
    f1_val = f"*{_safe(spec_name, '—')}*\n{_safe(report_date)}"

    f2_name = "Difficulty"
    f2_val = _safe(difficulty)

    f3_name = "Upgrade #"
    f3_val = _safe(upgrade_num)
    if links_str:
        f3_val = f"{f3_val}\n{links_str}"

    return [
        (f1_name, f1_val),
        (f2_name, f2_val),
        (f3_name, f3_val),
    ]

def build_embeds_from_rows(rows: List[List[str]], title: str) -> list[discord.Embed]:
    """Create a list of embeds with up to 8 rows per embed (3 fields per row = 24 fields)."""
    FIELDS_PER_ROW = 3
    ROWS_PER_EMBED = MAX_FIELDS_PER_EMBED // FIELDS_PER_ROW  # 8

    embeds: list[discord.Embed] = []
    total_pages = (len(rows) + ROWS_PER_EMBED - 1) // ROWS_PER_EMBED if rows else 1

    for page_idx in range(total_pages):
        start = page_idx * ROWS_PER_EMBED
        end = min(start + ROWS_PER_EMBED, len(rows))
        page_rows = rows[start:end]

        embed = discord.Embed(title=title, color=discord.Color.blurple())
        if len(rows) > ROWS_PER_EMBED:
            embed.set_footer(text=f"Page {page_idx + 1}/{total_pages}")

        for row in page_rows:
            for name, value in _row_to_three_inline_fields(row):
                embed.add_field(name=name[:256], value=value[:1024], inline=True)

        embeds.append(embed)

    if not embeds:
        embeds.append(discord.Embed(title=title, description="No results.", color=discord.Color.red()))

    return embeds

class PaginatedEmbeds(discord.ui.View):
    """Simple Prev/Next pagination for a list of embeds."""

    def __init__(self, embeds: list[discord.Embed], *, timeout: float = 180):
        super().__init__(timeout=timeout)
        self.embeds = embeds
        self.index = 0
        # Disable buttons if only one page
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

    @discord.app_commands.command(name="item",description="Look up an item in the sheet and show matching rows.")
    @discord.app_commands.describe(item_name="Exact item name to look up.")
    async def item(self, interaction: discord.Interaction, item_name: str):
        await interaction.response.defer(thinking=True)
        results = await interaction.client.loop.run_in_executor( None, find_matching_rows, self.worksheet, item_name)
        if not results:
            await interaction.followup.send(f"No results found for item '{item_name}'.")
            return
        embeds = build_embeds_from_rows(results, title=f"Item: {item_name}")
        view = PaginatedEmbeds(embeds)
        await interaction.followup.send(embed=embeds[0], view=view)

    @discord.app_commands.command(name="boss", description="Look up a boss and show all wishes for its items.")
    async def boss(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        bosses = await interaction.client.loop.run_in_executor(None, get_unique_bosses, self.worksheet)
        if not bosses:
            await interaction.followup.send("No bosses found in the sheet.")
            return
        view = BossPickerView(self.worksheet, bosses)
        await interaction.followup.send("Pick a boss:", view=view)

    @discord.app_commands.command(name="boss",description="Look up a boss and show all wishes for its items.")
    async def boss(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        bosses = await interaction.client.loop.run_in_executor(None, get_unique_bosses, self.worksheet)
        if not bosses:
            await interaction.followup.send("No bosses found in the sheet.")
            return
        view = BossPickerView(self.worksheet, bosses)
        await interaction.followup.send("Pick a boss:", view=view)

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