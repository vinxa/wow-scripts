import os
from typing import List
import asyncio
import discord
from discord.ext import commands
import gspread
from tabulate import tabulate
import logging

logging.basicConfig(level=logging.INFO)

GOOGLE_SHEET_URL = (os.environ.get("GOOGLE_SHEET_URL"))
WORKSHEET_NAME = os.environ.get("WORKSHEET_NAME")

def get_gspread_client() -> gspread.client.Client:
    cred_file = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    return gspread.service_account(filename=cred_file)

def find_matching_rows(
    worksheet: gspread.worksheet.Worksheet, item_name: str) -> List[List[str]]:
    all_values = worksheet.get_all_values()
    records = all_values[1:]  # Skip header
    results: List[List[str]] = []
    target = item_name.strip().lower()
    for row in records:
        padded_row = row + [""] * (11 - len(row))
        current_item = padded_row[5].strip().lower()
        if current_item == target:
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

        headers = ["Character", "Spec", "Date", "Difficulty", "Upgrade #", "Icy Veins", "Wowhead"]
        table_str = tabulate(results, headers=headers, tablefmt="fancy_grid")

        max_chunk_size = 1900
        for i in range(0, len(table_str), max_chunk_size):
            chunk = table_str[i : i + max_chunk_size]
            await interaction.followup.send(f"```\n{chunk}\n```")

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

        headers = ["Character", "Spec", "Date", "Difficulty", "Upgrade #", "Icy Veins", "Wowhead"]
        table_str = tabulate(results, headers=headers, tablefmt="fancy_grid")

        max_chunk_size = 1900  # keep under 2000 incl. code fences
        # First message continues the deferred response; subsequent ones are followups.
        first = True
        for i in range(0, len(table_str), max_chunk_size):
            chunk = table_str[i : i + max_chunk_size]
            content = f"```\n{chunk}\n```"
            if first:
                await interaction.followup.send(content)
                first = False
            else:
                await interaction.followup.send(content)

    @discord.app_commands.command(name="boss",description="Look up a boss and show all wishes for its items.")
    async def boss(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        bosses = await interaction.client.loop.run_in_executor(
            None, get_unique_bosses, self.worksheet
        )
        if not bosses:
            await interaction.followup.send("No bosses found in the sheet.")
            return
        view = BossPickerView(self.worksheet, bosses)
        await interaction.response.send_message("Pick a boss:", view=view)

class LootClient(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
    async def setup_hook(self):
        await self.add_cog(LootCommands(self))
    async def on_ready(self):
        print(f"Logged in as {self.user} (ID: {self.user.id})")
async def run_bot():
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise RuntimeError("DISCORD_TOKEN not set")
    bot = LootClient()
    await bot.start(token)

if __name__ == "__main__":
    asyncio.run(run_bot())