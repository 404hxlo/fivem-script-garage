/* Resource generator: builds every file for a standalone FiveM resource. Pure function, no DOM. */
function generateResource(o) {
  var name = o.name;
  var useConfig = !!o.config, nui = !!o.nui, cooldown = !!o.cooldown, marker = !!o.marker;
  var luaStr = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n]+/g, ' '); };
  var title = o.title || name.replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  var helpKey = name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_HELP';
  var ev = name + ':server:use';

  // value names: Config.X when there is a shared config, local constants otherwise
  var K = useConfig
    ? { loc: 'Config.Location', md: 'Config.MarkerDistance', id: 'Config.InteractDistance', cd: 'Config.Cooldown', opts: 'Config.Options', title: 'Config.Title' }
    : { loc: 'LOCATION', md: 'MARKER_DISTANCE', id: 'INTERACT_DISTANCE', cd: 'COOLDOWN_SECONDS', opts: 'OPTIONS', title: 'MENU_TITLE' };

  var optionLines = [
    "{ id = 'water', label = 'Water', price = 5 },",
    "{ id = 'sandwich', label = 'Sandwich', price = 8 },",
    "{ id = 'coffee', label = 'Coffee', price = 4 },"
  ];
  var indent = function (lines, pad) { return lines.map(function (l) { return l ? pad + l : l; }); };

  var files = [];

  // ---------- fxmanifest.lua ----------
  var m = [
    "fx_version 'cerulean'",
    "game 'gta5'",
    '',
    "author '" + luaStr(o.author || 'You') + "'",
    "description '" + luaStr(o.description || 'Generated with FiveM Script Garage') + "'",
    "version '1.0.0'",
    ''
  ];
  if (useConfig) m.push("shared_script 'config.lua'   -- loaded on client AND server");
  m.push("client_script 'client.lua'");
  m.push("server_script 'server.lua'");
  if (nui) {
    m.push('', "ui_page 'html/index.html'", '', '-- every file the NUI page needs must be listed here', 'files {',
      "    'html/index.html',", "    'html/style.css',", "    'html/app.js'", '}');
  }
  files.push({ path: 'fxmanifest.lua', lang: 'lua', content: m.join('\n') + '\n' });

  // ---------- config.lua ----------
  if (useConfig) {
    var c = ['Config = {}', ''];
    c.push("Config.Title = '" + luaStr(title) + "'");
    if (marker) {
      c.push('', '-- Where the marker sits. Stand on the spot in game and run /' + name + '_coords to get yours.',
        'Config.Location = vector3(25.7, -1347.3, 29.5)',
        'Config.MarkerDistance = 15.0   -- the marker is drawn within this range',
        'Config.InteractDistance = 1.5  -- "press E" works within this range');
    }
    if (cooldown) c.push('', '-- Seconds a player must wait between uses (enforced on the server)', 'Config.Cooldown = 10');
    if (nui) {
      c.push('', '-- Menu options. The server reads prices from HERE, never from the client.', 'Config.Options = {');
      c = c.concat(indent(optionLines, '    '), ['}']);
    }
    files.push({ path: 'config.lua', lang: 'lua', content: c.join('\n') + '\n' });
  }

  // ---------- client.lua ----------
  var cl = ['-- ' + name + ' / client.lua', '-- Runs on every player\'s PC. Never decide money, items or rewards here.', ''];
  if (!useConfig) {
    var consts = [];
    if (nui) consts.push("local MENU_TITLE = '" + luaStr(title) + "'", 'local OPTIONS = {', ...indent(optionLines, '    '), '}');
    if (marker) consts.push('local LOCATION = vector3(25.7, -1347.3, 29.5)', 'local MARKER_DISTANCE = 15.0', 'local INTERACT_DISTANCE = 1.5');
    if (consts.length) cl = cl.concat(consts, ['']);
  }
  if (nui) {
    cl.push(
      'local menuOpen = false',
      '',
      'local function openMenu()',
      '    if menuOpen then return end',
      '    menuOpen = true',
      '    SetNuiFocus(true, true)',
      '    SendNUIMessage({ action = \'open\', title = ' + K.title + ', options = ' + K.opts + ' })',
      'end',
      '',
      'local function closeMenu()',
      '    menuOpen = false',
      '    SetNuiFocus(false, false)',
      '    SendNUIMessage({ action = \'close\' })',
      'end',
      '',
      '-- The page asks to close (close button or Escape)',
      "RegisterNuiCallback('close', function(_, cb)",
      '    closeMenu()',
      '    cb({ ok = true }) -- always answer, or the page\'s fetch times out',
      'end)',
      '',
      '-- The page sends the option the player clicked',
      "RegisterNuiCallback('select', function(data, cb)",
      '    closeMenu()',
      '    if type(data) == \'table\' and type(data.id) == \'string\' then',
      '        -- only send WHAT they picked; the server looks up the price itself',
      "        TriggerServerEvent('" + ev + "', data.id)",
      '    end',
      '    cb({ ok = true })',
      'end)',
      '',
      '-- Never leave the cursor stuck if the resource restarts while the menu is open',
      "AddEventHandler('onResourceStop', function(resourceName)",
      '    if resourceName == GetCurrentResourceName() and menuOpen then',
      '        SetNuiFocus(false, false)',
      '    end',
      'end)',
      ''
    );
  }
  cl.push('local function interact()');
  if (nui) cl.push('    openMenu()');
  else cl.push("    TriggerServerEvent('" + ev + "')");
  cl.push('end', '');

  if (marker) {
    cl.push(
      "AddTextEntry('" + helpKey + "', 'Press ~INPUT_CONTEXT~ to " + (nui ? 'open the menu' : 'interact') + "')",
      '',
      'CreateThread(function()',
      '    while true do',
      '        local sleep = 1000 -- far away: check once per second to save CPU',
      '        local coords = GetEntityCoords(PlayerPedId())',
      '        local distance = #(coords - ' + K.loc + ')',
      '',
      '        if distance < ' + K.md + ' then',
      '            sleep = 0 -- close by: run every frame so the marker is smooth',
      '            DrawMarker(2, ' + K.loc + '.x, ' + K.loc + '.y, ' + K.loc + '.z,',
      '                0.0, 0.0, 0.0, 0.0, 180.0, 0.0, 0.3, 0.3, 0.3,',
      '                245, 176, 66, 200, true, true, 2, false, nil, nil, false)',
      '',
      '            if distance < ' + K.id + (nui ? ' and not menuOpen' : '') + ' then',
      "                BeginTextCommandDisplayHelp('" + helpKey + "')",
      '                EndTextCommandDisplayHelp(0, false, false, -1)',
      '',
      '                if IsControlJustReleased(0, 38) then -- 38 = E',
      '                    interact()',
      '                end',
      '            end',
      '        end',
      '',
      '        Wait(sleep)',
      '    end',
      'end)',
      '',
      '-- Helper while setting up: prints your position so you can paste it into the config.',
      '-- Delete this command when you are done.',
      "RegisterCommand('" + name + "_coords', function()",
      '    local pos = GetEntityCoords(PlayerPedId())',
      "    local text = ('vector3(%.2f, %.2f, %.2f)'):format(pos.x, pos.y, pos.z)",
      '    print(text)',
      "    TriggerEvent('chat:addMessage', { args = { '" + luaStr(title) + "', text } })",
      'end, false)'
    );
  } else {
    cl.push(
      '-- No marker selected, so players use a command instead: /' + name,
      "RegisterCommand('" + name + "', function()",
      '    interact()',
      'end, false)'
    );
  }
  files.push({ path: 'client.lua', lang: 'lua', content: cl.join('\n') + '\n' });

  // ---------- server.lua ----------
  var sv = ['-- ' + name + ' / server.lua', '-- The source of trust: validate everything the client sends.', ''];
  if (!useConfig) {
    var sc = [];
    if (nui) sc.push('local OPTIONS = {', ...indent(optionLines, '    '), '}');
    if (marker) sc.push('local LOCATION = vector3(25.7, -1347.3, 29.5)', 'local INTERACT_DISTANCE = 1.5');
    if (cooldown) sc.push('local COOLDOWN_SECONDS = 10');
    if (sc.length) sv = sv.concat(sc, ['']);
  }
  if (cooldown) sv.push('local lastUse = {} -- [serverId] = os.time() of their last use', '');
  sv.push(
    'local function notify(src, message)',
    "    TriggerClientEvent('chat:addMessage', src, {",
    '        color = { 245, 176, 66 },',
    "        args = { '" + luaStr(title) + "', message }",
    '    })',
    'end',
    ''
  );
  if (nui) {
    sv.push(
      'local function findOption(id)',
      '    for _, option in ipairs(' + K.opts + ') do',
      '        if option.id == id then',
      '            return option',
      '        end',
      '    end',
      '    return nil',
      'end',
      ''
    );
  }
  sv.push("RegisterNetEvent('" + ev + "', function(" + (nui ? 'optionId' : '') + ')');
  sv.push('    local src = source -- copy it before anything else');
  if (nui) {
    sv.push(
      '',
      '    -- 1. Whitelist: the option must exist in the SERVER\'s list',
      "    if type(optionId) ~= 'string' then return end",
      '    local option = findOption(optionId)',
      '    if not option then return end'
    );
  }
  if (marker) {
    sv.push(
      '',
      '    -- ' + (nui ? '2' : '1') + '. Distance: is the player really at the marker? (server-side position, needs OneSync)',
      '    local ped = GetPlayerPed(src)',
      '    if #(GetEntityCoords(ped) - ' + K.loc + ') > ' + K.id + ' + 2.0 then',
      "        print(('[" + name + "] %s used it from too far away'):format(GetPlayerName(src)))",
      '        return',
      '    end'
    );
  }
  if (cooldown) {
    var step = 1 + (nui ? 1 : 0) + (marker ? 1 : 0);
    sv.push(
      '',
      '    -- ' + step + '. Cooldown',
      '    local now = os.time()',
      '    if lastUse[src] and now - lastUse[src] < ' + K.cd + ' then',
      "        notify(src, ('Please wait %d more seconds.'):format(math.ceil(" + K.cd + ' - (now - lastUse[src]))))',
      '        return',
      '    end',
      '    lastUse[src] = now'
    );
  }
  if (nui || marker || cooldown) sv.push('', '    -- All checks passed: do the action using values the SERVER decided.');
  else sv.push('', '    -- Add checks here before acting (distance, cooldown, permissions: see the Security lesson).');
  if (nui) {
    sv.push(
      "    notify(src, ('You bought %s for $%d.'):format(option.label, option.price))",
      '',
      '    -- Framework example (uncomment the one you use):',
      "    -- QBCore: local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayer(src)",
      "    --         if Player and Player.Functions.RemoveMoney('cash', option.price) then ... end",
      "    -- ESX:    local xPlayer = exports['es_extended']:getSharedObject().GetPlayerFromId(src)",
      '    --         if xPlayer and xPlayer.getMoney() >= option.price then xPlayer.removeMoney(option.price) ... end'
    );
  } else {
    sv.push(
      "    notify(src, 'It worked! Replace this with your own action.')",
      '',
      '    -- Framework example (uncomment the one you use):',
      "    -- QBCore: local Player = exports['qb-core']:GetCoreObject().Functions.GetPlayer(src)",
      "    -- ESX:    local xPlayer = exports['es_extended']:getSharedObject().GetPlayerFromId(src)"
    );
  }
  sv.push('end)');
  if (cooldown) {
    sv.push('', '-- Clean up when a player leaves', "AddEventHandler('playerDropped', function()", '    lastUse[source] = nil', 'end)');
  }
  files.push({ path: 'server.lua', lang: 'lua', content: sv.join('\n') + '\n' });

  // ---------- NUI ----------
  if (nui) {
    files.push({ path: 'html/index.html', lang: 'html', content: [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '    <meta charset="utf-8">',
      '    <title>' + name + '</title>',
      '    <link rel="stylesheet" href="style.css">',
      '</head>',
      '<body>',
      '    <div id="menu" class="menu hidden">',
      '        <div class="menu-header">',
      '            <h1 id="title">Menu</h1>',
      '            <button id="close" class="close" aria-label="Close">&times;</button>',
      '        </div>',
      '        <div id="options" class="options"></div>',
      '        <p class="hint">Press ESC to close</p>',
      '    </div>',
      '    <script src="app.js"></' + 'script>',
      '</body>',
      '</html>'
    ].join('\n') + '\n' });

    files.push({ path: 'html/app.js', lang: 'js', content: [
      "const menu = document.getElementById('menu');",
      "const title = document.getElementById('title');",
      "const list = document.getElementById('options');",
      '',
      '// Call a RegisterNuiCallback handler in client.lua',
      'function post(name, data = {}) {',
      '    return fetch(`https://${GetParentResourceName()}/${name}`, {',
      "        method: 'POST',",
      "        headers: { 'Content-Type': 'application/json; charset=UTF-8' },",
      '        body: JSON.stringify(data)',
      '    }).then((resp) => resp.json()).catch(() => ({}));',
      '}',
      '',
      'function render(options) {',
      "    list.innerHTML = '';",
      '    options.forEach((option) => {',
      "        const button = document.createElement('button');",
      "        button.className = 'option';",
      '',
      "        const label = document.createElement('span');",
      '        label.textContent = option.label; // textContent, never innerHTML, for data',
      '        button.appendChild(label);',
      '',
      '        if (option.price !== undefined) {',
      "            const price = document.createElement('span');",
      "            price.className = 'price';",
      "            price.textContent = '$' + option.price;",
      '            button.appendChild(price);',
      '        }',
      '',
      "        button.addEventListener('click', () => post('select', { id: option.id }));",
      '        list.appendChild(button);',
      '    });',
      '}',
      '',
      '// Messages from client.lua (SendNUIMessage)',
      "window.addEventListener('message', (event) => {",
      '    const data = event.data;',
      "    if (data.action === 'open') {",
      "        title.textContent = data.title || 'Menu';",
      '        render(data.options || []);',
      "        menu.classList.remove('hidden');",
      "    } else if (data.action === 'close') {",
      "        menu.classList.add('hidden');",
      '    }',
      '});',
      '',
      "document.getElementById('close').addEventListener('click', () => post('close'));",
      '',
      "document.addEventListener('keydown', (event) => {",
      "    if (event.key === 'Escape') post('close');",
      '});'
    ].join('\n') + '\n' });

    files.push({ path: 'html/style.css', lang: 'css', content: [
      '* { box-sizing: border-box; }',
      '',
      '/* keep the page transparent so the game shows through */',
      'html, body { margin: 0; background: transparent; font-family: "Segoe UI", Arial, sans-serif; }',
      '',
      '.hidden { display: none !important; }',
      '',
      '.menu {',
      '    position: absolute;',
      '    top: 50%;',
      '    right: 6%;',
      '    transform: translateY(-50%);',
      '    width: 300px;',
      '    padding: 18px;',
      '    border-radius: 12px;',
      '    background: rgba(14, 18, 24, 0.94);',
      '    border: 1px solid rgba(255, 255, 255, 0.08);',
      '    color: #eef2f6;',
      '    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);',
      '}',
      '',
      '.menu-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }',
      '.menu-header h1 { margin: 0; font-size: 18px; letter-spacing: 0.02em; }',
      '',
      '.close { background: none; border: 0; color: #9aa7b4; font-size: 24px; cursor: pointer; line-height: 1; }',
      '.close:hover { color: #fff; }',
      '',
      '.options { display: flex; flex-direction: column; gap: 8px; }',
      '',
      '.option {',
      '    display: flex;',
      '    justify-content: space-between;',
      '    padding: 12px 14px;',
      '    border: 1px solid rgba(255, 255, 255, 0.08);',
      '    border-radius: 8px;',
      '    background: rgba(255, 255, 255, 0.04);',
      '    color: inherit;',
      '    font-size: 15px;',
      '    cursor: pointer;',
      '}',
      '.option:hover { background: rgba(245, 176, 66, 0.16); border-color: rgba(245, 176, 66, 0.6); }',
      '.price { color: #f5b042; font-weight: 600; }',
      '',
      '.hint { margin: 12px 0 0; font-size: 12px; color: #7d8a97; text-align: center; }'
    ].join('\n') + '\n' });
  }

  // ---------- folder tree ----------
  var order = files.map(function (f) { return f.path; });
  var top = order.filter(function (p) { return p.indexOf('/') < 0; });
  var html = order.filter(function (p) { return p.indexOf('html/') === 0; });
  var tree = ['resources', '└── [local]', '    └── ' + name];
  var rows = top.slice();
  if (html.length) rows.push('html/');
  rows.forEach(function (p, i) {
    var last = i === rows.length - 1;
    tree.push('        ' + (last ? '└── ' : '├── ') + p);
    if (p === 'html/') {
      html.forEach(function (h, j) {
        tree.push('            ' + (j === html.length - 1 ? '└── ' : '├── ') + h.slice(5));
      });
    }
  });

  return { files: files, cfg: 'ensure ' + name, tree: tree.join('\n') };
}
if (typeof module !== 'undefined') module.exports = generateResource;
