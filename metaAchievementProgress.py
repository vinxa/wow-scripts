#!/usr/bin/env python3
"""
metaAchievementProgress.py

Generate a static HTML page showing a WoW character's progress towards an achievement.

Usage:
    python metaAchievementProgress.py \
        --character <character> \
        --server <server> \
        --achievement-id <id> \
        --output <output_dir> [--suggest] [--debug]

Use --suggest to list example achievement IDs.
"""
import argparse
import sys
from pathlib import Path
from string import Template

import requests

HTML_TEMPLATE = Template("""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>$title - $character-$server</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">
    <style>        :root {
            --bg-color: #0a0a0a;
            --overlay-color: rgba(0, 0, 0, 0.6);
            --success-color: #28a745;
            --danger-color: #dc3545;
            --font-family: 'Segoe UI', Tahoma, sans-serif;
            --transition-speed: 0.3s;
        }
        .list-group-item-success {
    color: #539957;
}
.list-group-item-danger {
    color: #dc3545;
}
        body {
        margin: 0;
        font-family: var(--font-family);
        background: var(--bg-color);
        color: #fff;
        }
        /* Gradient overlay for depth */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            background: linear-gradient(180deg, rgba(24, 23, 23, 0.9) 0%, rgba(56, 38, 38, 0.5) 150%);
            pointer-events: none;
            z-index: -1;
        }
        .container {
            backdrop-filter: blur(5px);
        }
        .list-group-item {
            background: rgba(255, 255, 255, 0.1);
            border: none;
            margin-bottom: 0.5rem;
            border-radius: 8px;
            transition: background var(--transition-speed);
        }
        .list-group-item:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        .list-group > ul {
            margin-left: 1.5rem;
        }
        .sadarrow, .happyarrow {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-width: 0 3px 3px 0;
            border-style: solid;
            margin-right: 0.5em;
            transition: transform var(--transition-speed);
            transform: rotate(-45deg);
        }
        .sadarrow { border-color: var(--danger-color); }
        .happyarrow { border-color: var(--success-color); }
        .down { transform: rotate(45deg); }
        .step-icon {
            width: 24px;
            height: 24px;
            margin-right: 0.5em;
        }
        h1 {
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            margin-bottom: 2rem;
            text-align: center;
        }
        .list-group-item a {
        color: inherit !important;
        text-decoration: none !important;
        }

        .list-group-item a:hover,
        .list-group-item a:focus {
        text-decoration: underline !important;
        }

        .list-group-item-action {
            cursor:pointer;
        }

        .nodrop {
            cursor: default;
        }

        ul.collapse {
            display:block !important;
            max-height: 0;
            overflow: hidden;
            transition: max-height var(--transition-speed);
        }

        ul.collapse.show {
            max-height: 2000px;
        }
    </style>
</head>
<body>
    <div class="container mt-5">
        <h1 class="text-capitalize">$title - $character - $server</h1>
        <ul class="list-group ">
            $body
        </ul>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js"></script>
    <script>
    document.querySelectorAll('.list-group-item-action')
    .forEach(item => {
        item.addEventListener('click', () => {
        const arrow = item.querySelector('.happyarrow, .sadarrow');
        if (arrow) arrow.classList.toggle('down');
        const target = document.querySelector(item.getAttribute('data-target'));
        if (!target) return;
        target.classList.toggle('show');
        });
    });
        document.querySelectorAll('.list-group-item-action')
            .forEach(el => el.addEventListener('click', () => el.blur()));
    </script>
</body>
</html>
""")

EXAMPLE_IDS = {
    19458: "A World Awoken (Dragonflight)",
    20501: "Back from the Beyond (Shadowlands)",
    40953: "A Farewell to Arms (Battle for Azeroth)",
}

def print_suggestions():
    print("Example achievement IDs:")
    for aid, name in EXAMPLE_IDS.items():
        print(f"  {aid}: {name}")


def fetch_achievement(ach_id, server, character, debug=False):
    url = f"https://worldofwarcraft.blizzard.com/en-us/character/us/{server}/{character}/achievement/{ach_id}"
    if debug:
        print(f"[DEBUG] GET {url}")
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json().get('achievement', {})
        if debug:
            print(f"[DEBUG] Keys received: {list(data.keys())}")
        return data
    except requests.RequestException as err:
        print(f"Error fetching achievement: {err}", file=sys.stderr)
        return {}


def collect_steps(ach_id, server, character, debug=False):
    data = fetch_achievement(ach_id, server, character, debug)
    if not data or data.get('time'):
        return []

    items = []
    for step in data.get('steps', []):
        icon_url = step.get('icon', {}).get('url')

        if 'url' in step:
            sub_id = int(Path(step['url']).name)
            sub_meta = fetch_achievement(sub_id, server, character, debug)
            if debug:
                print(f"[DEBUG] Sub-achievement {sub_id} metadata keys: {list(sub_meta.keys())}")

            sub_name = sub_meta.get('name', step.get('description', ''))
            sub_desc = sub_meta.get('description', '')

            sub_items = collect_steps(sub_id, server, character, debug)

            items.append({
                'done':        step.get('completed', False),
                'name':        sub_name,
                'description': sub_desc,
                'id':          sub_id,
                'icon':        icon_url,
                'sub':         sub_items,
            })

        else:
            items.append({
                'done':        step.get('completed', False),
                'name':        step.get('description', ''),
                'description': '',  
                'icon':        icon_url,
            })

    for prog in data.get('progressSteps', []):
        items.append({
            'done':  prog.get('completed', False),
            'count': prog.get('count', 0),
            'total': prog.get('total', 0),
        })

    return items



def render_list(items, depth=0, parent_done=False, background_url=None):
    depth = min(depth, 5)
    indent_class = f'a{depth}'
    html = ''

    for item in items:
        done = parent_done or item.get('done', False)
        status = 'success' if done else 'danger'
        arrow = 'happyarrow' if done else 'sadarrow'
        classes = f"list-group-item list-group-item-action list-group-item-{status} {indent_class}"

        icon_html = f"<img src='{item['icon']}' class='step-icon'/>" if item.get('icon') else ''
        name = item.get('name', '')

        id = ''
        if item.get('id') is not None:
            aid = item['id']
            id += f" (<a href='https://www.wowhead.com/achievement={aid}' target='_blank' rel='noopener noreferrer' class='achiev-link'>{aid}</a>) "

        desc = ''
        if item.get('description'):
            desc = f" <span class='achiev-desc'>{item['description']}</span>"

        if item.get('sub'):
            sub_html = render_list(item['sub'], depth + 1, done)
            html += (
                f"<ul class='list-group'>"
                f"<li class='{classes}' data-target='#i{item['id']}'>"
                f"{icon_html}<i class='{arrow}'></i>{name} <small class='text-muted'>{id}{desc}</small></li>"
                f"<ul id='i{item['id']}' class='collapse list-group '>{sub_html}</ul>"
                f"</ul>"
            )
        elif 'total' in item:
            html += f"<ul class='list-group '><li class='{classes} nodrop'>{icon_html}{item['count']}/{item['total']}<small class='text-muted'>{desc}</small></li></ul>"
        else:
            html += f"<ul class='list-group '><li class='{classes} nodrop'>{icon_html}{name}<small class='text-muted'>{id}{desc}</small></li></ul>"

    return html


def create_page(ach_id, server, character, output_dir, debug=False):
    server_clean = server.replace("'", "")
    root = fetch_achievement(ach_id, server_clean, character, debug)
    if not root:
        print("No achievement data.")
        return
    if 'time' in root:
        print(f"{character} completed at {root['time']}")
        return

    title = root.get('name', 'Achievement')
    steps = collect_steps(ach_id, server_clean, character, debug)
    body_html = render_list(steps)

    html = HTML_TEMPLATE.substitute(
        title=title,
        character=character,
        body=body_html,
        server=server
    )

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    file_path = output_path / f"{character}-{ach_id}.html"
    file_path.write_text(html, encoding='utf-8')
    print(f"Generated: {file_path}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate WoW achievement progress page"
    )
    parser.add_argument('-c', '--character', required=False, help='Character name')
    parser.add_argument('-s', '--server', required=False, help='Server name')
    parser.add_argument('-a', '--achievement-id', dest='ach_id', type=int, required=False, help='Achievement ID')
    parser.add_argument('-o', '--output', dest='output_dir', required=False, help='Output directory')
    parser.add_argument('--debug', action='store_true', help='Enable debug output')
    parser.add_argument('--suggest', action='store_true', help='List example achievement IDs')
    return parser.parse_args()


def main():
    args = parse_args()
    if args.suggest:
        print_suggestions()
        return

    if not all([args.character, args.server, args.ach_id, args.output_dir]):
        print("Error: Missing required arguments. Use --help for details.")
        sys.exit(1)

    create_page(
        ach_id=args.ach_id,
        server=args.server,
        character=args.character,
        output_dir=args.output_dir,
        debug=args.debug,
    )


if __name__ == '__main__':
    main()
