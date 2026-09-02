from pathlib import Path

view = Path('src/components/pwa/DriverMobileView.tsx')
text = view.read_text()

anchor = "import{uploadOwnAvatar}from'../../lib/profileMediaRepository';\n"
if anchor not in text:
    raise SystemExit('No encontré import de profileMediaRepository')
if "import{DriverPriorityCounter}from'./DriverPriorityCounter';" not in text:
    text = text.replace(anchor, anchor + "import{DriverPriorityCounter}from'./DriverPriorityCounter';\n", 1)

slot = '<div id="driver-queue-summary-slot" />'
if text.count(slot) != 1:
    raise SystemExit(f'Esperaba un slot de fila y encontré {text.count(slot)}')
text = text.replace(slot, '<DriverPriorityCounter/>', 1)
view.write_text(text)

app = Path('src/App.tsx')
text = app.read_text()
imp = "import {DriverPriorityCounter} from './components/pwa/DriverPriorityCounter';"
if text.count(imp) != 1:
    raise SystemExit(f'Esperaba un import DriverPriorityCounter y encontré {text.count(imp)}')
text = text.replace(imp, '', 1)
old = '<DriverMobileShell/><DriverPriorityCounter/><DriverToCentralRadioPanel/>'
if text.count(old) != 1:
    raise SystemExit(f'Esperaba un montaje global DriverPriorityCounter y encontré {text.count(old)}')
text = text.replace(old, '<DriverMobileShell/><DriverToCentralRadioPanel/>', 1)
app.write_text(text)

if 'driver-queue-summary-slot' in view.read_text():
    raise SystemExit('Quedó el slot DOM antiguo')
if imp in app.read_text() or '<DriverMobileShell/><DriverPriorityCounter/>' in app.read_text():
    raise SystemExit('Quedó el montaje global antiguo')

print('Hotfix portal aplicado')
