# BYPCMS panels

The existing Business demo is the visual reference for installed customer panels. Preserve its dark #232d28 sidebar, #f4f6f4 work surface, white table surfaces, Manrope typography, muted green #50685d primary controls, lime BYPCMS brand and 12px card corners. Runtime ownership remains app/demo/demo.css plus shared workspace/panel styles.

WorkspaceFrame owns the sidebar, project badge, grouped navigation, top bar and content layout for demo and installations. PanelTable owns tables, row menus and selection; PanelSearch owns search; PanelSession owns real authentication; LicenseSettings and UpdateSettings own real installation lifecycle controls. The demo keeps isolated data and its edition chooser. Customer panels show only server-authorized capabilities and actual project data.

Site themes cannot change the admin shell. Custom theme controls are declared by a project adapter, validated on the server and applied by its public renderer. A missing capability has no decorative control or menu item.

Native selects are the existing canonical choice. Keep full labels, visible focus and sufficient touch targets. Forms grow with their content; only data-table surfaces may scroll horizontally. At narrow widths the existing responsive workspace menu and shared table behavior remain authoritative. Motion respects prefers-reduced-motion. Global scrollbar styling is owned by workspace-common.css and workspace-menu.css.

Section navigation keeps the sidebar/topbar mounted. Fast API requests do not flash status text; PanelPending reserves space and reveals a modest inline indicator only for slower requests. ClientUpload owns the white, dashed-border upload surface, an explicit green file-selection button and persistent per-file results; raw file-input chrome is never the visible action. This surface is shared by customer media and image fields, with compact stacking at mobile widths.
