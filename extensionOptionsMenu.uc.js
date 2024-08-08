// ==UserScript==
// @name            Extension Options Menu
// @author          Den_loob (independent partial rewrite) + xiaoxiaoflood (Original)
// ==/UserScript==

// Independent partial rewrite of https://raw.githubusercontent.com/xiaoxiaoflood/firefox-scripts/7ce14e8e423405fdb34abb516f0e6681f6a3408a/chrome/extensionOptionsMenu.uc.js

// Usage: Click the new icon in the extension bar. Hover over the extension you want to enable/disable and right click. That's it! Left click to view the config (if any) and middle click to view the homepage.
(function(){
UC = {};
UC.extensionOptionsMenu = {
  // config
  showVersion: false,
  showHidden: false,
  showDisabled: true,
  enabledFirst: true,
  blackListArray: [],

  init: function() {
    const { CustomizableUI } = window;
    CustomizableUI.createWidget({
      id: 'eom-button',
      type: 'custom',
      defaultArea: CustomizableUI.AREA_NAVBAR,
      onBuild: function(doc) {
        let btn = doc.createXULElement('toolbarbutton');
        btn.id = 'eom-button';
        btn.label = 'Extension Options Menu';
        btn.tooltiptext = 'Extension Options Menu';
        btn.type = 'menu';
        btn.className = 'toolbarbutton-1 chromeclass-toolbar-additional';
        btn.image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABaUlEQVQ4y6WTW0sCQRiG/SEpVBDUVVfphbAEhWAlqYhrLWUlER2IIgrqYkEp6SBmudWiFf0SiSCwpAI7bJnprq6H/sTbGhJiEyt28fAN7zfz8DHDaABo/oPqBpovX7j4T1gOS6dNCcYiZbhOSrCHi2hugqNCwskVYNmXbxoSuPkCN3NWhCdahLLGKCfDcSBjOJiHeTeHPr8EyifCwGb9RMF0RIaHl+E+zoMJ5+AM5WALSBjaEWHayqLXm4GR/YB+Iw2iYIKTMB6WwIRE0EER9r0s+r1pGNZT6F55ReeigPb5F7TOPpMFTDCDkUAGA753GFYFdC08QedJEvkR2DbfzuntFBz+1K2ZFdCz9Ii2qQfo3Pck2MoZpVI/AqtXQAXjchIdk3fQMok/Ib6CaS0Z1c8pdlc8pqXjUOF7AqVSxDvQOq7RKERBi/UKdbDVnK3vkQWWS9Si1vstGIyxCqiBquZUXc429BfU+AL9Tqy8Q2Za8AAAAABJRU5ErkJggg==';
        btn.onclick = function(event) {
          if (event.button === 1) BrowserOpenAddonsMgr("addons://list/extension");
        };

        let mp = doc.createXULElement('menupopup');
        mp.id = 'eom-button-popup';
        mp.onclick = function(event) {
          event.preventDefault();
          event.stopPropagation();
        };
        btn.appendChild(mp);

        mp.addEventListener('popupshowing', UC.extensionOptionsMenu.evalPopulateMenu);

        return btn;
      }
    });

    this.setStyle();
    Services.sss.loadAndRegisterSheet(this.STYLE.url, this.STYLE.type);
  },

  evalPopulateMenu: function(e) {
    new e.view.Function('e', `
      AddonManager.getAddonsByTypes(['extension']).then(addons => UC.extensionOptionsMenu.populateMenu(e, addons));
    `).call(null, e);
  },

  populateMenu: function(e, addons) {
    let prevState;
    let popup = e.target;
    let doc = e.view.document;
    let enabledFirst = UC.extensionOptionsMenu.enabledFirst;
    let showVersion = UC.extensionOptionsMenu.showVersion;
    let showDisabled = UC.extensionOptionsMenu.showDisabled;
    let blackListArray = UC.extensionOptionsMenu.blackListArray;

    while (popup.hasChildNodes()) {
      popup.removeChild(popup.firstChild);
    }

    addons.sort((a, b) => {
      let ka = (enabledFirst ? a.isActive ? '0' : '1' : '') + a.name.toLowerCase();
      let kb = (enabledFirst ? b.isActive ? '0' : '1' : '') + b.name.toLowerCase();
      return (ka < kb) ? -1 : 1;
    }).forEach(addon => {
      if (!blackListArray.includes(addon.id) &&
        (!addon.hidden || UC.extensionOptionsMenu.showHidden) &&
        (!addon.userDisabled || UC.extensionOptionsMenu.showDisabled)) {
        if (showDisabled && enabledFirst && prevState && addon.isActive != prevState)
          popup.appendChild(doc.createXULElement('menuseparator'));
        prevState = addon.isActive;

        let mi = doc.createXULElement('menuitem');
        mi.label = addon.name + (showVersion ? ' ' + addon.version : '');
        mi.className = 'menuitem-iconic';
        mi.image = addon.iconURL || UC.extensionOptionsMenu.iconURL;
        mi.addEventListener('click', UC.extensionOptionsMenu.handleClick);
        mi._Addon = addon;
        mi.setAttribute('context', '');

        UC.extensionOptionsMenu.setDisable(mi, addon, 0);

        popup.appendChild(mi);
      }
    });
  },

  handleClick: function(event) {
    event.preventDefault();
    event.stopPropagation();

    const {
      target: menuitem,
      view: win
    } = event;

    const { AddonManager, closeMenus, openURL } = win;

    if (!('_Addon' in menuitem)) {
      return;
    }

    let addon = menuitem._Addon;

    switch (event.button) {
      case 0:
        if (addon.optionsURL) {
          UC.extensionOptionsMenu.openAddonOptions(addon, win);
          break
        }
        // Else, fallthrough
      case 1:
        if (addon.homepageURL) {
          openURL(addon.homepageURL);
          closeMenus(menuitem);
        }
        break;
      case 2:
        if (addon.userDisabled)
          addon.enable();
        else
          addon.disable();

        UC.extensionOptionsMenu.setDisable(menuitem, addon, 1);

        let popup = document.getElementById('eom-button-popup');
        if (popup) {
          while (popup.firstChild) {
            popup.removeChild(popup.firstChild);
          }
          UC.extensionOptionsMenu.evalPopulateMenu({ target: popup, view: window });
        }
        break;
    }
  },

  setDisable: function(menuitem, addon, toggling) {
    let cls = menuitem.classList;

    if (addon.operationsRequiringRestart) {
      if (toggling)
        if (addon.userDisabled)
          if (addon.isActive)
            cls.add('disabling');
          else
            cls.remove('enabling');
        else
          if (addon.isActive)
            cls.remove('disabling');
          else
            cls.add('enabling');
      else if (addon.userDisabled && addon.isActive)
        cls.add('disabling');
      else if (!addon.userDisabled && !addon.isActive)
        cls.add('enabling');
    } else {
      if (toggling) {
        if (addon.isActive) {
          if (addon.optionsURL)
            cls.remove('noOptions');
          cls.remove('disabled');
          cls.remove('disabling');
          cls.add('enabling');
        } else {
          cls.remove('enabling');
          cls.add('disabling');
        }
      }
    }

    if (!addon.isActive)
      cls.add('disabled');

    if (!addon.optionsURL)
      cls.add('noOptions');
  },

  openAddonOptions: function(addon, win) {
    if (!addon.isActive || !addon.optionsURL)
      return;

    switch (Number(addon.optionsType)) {
      case 5:
        win.BrowserOpenAddonsMgr('addons://detail/' + encodeURIComponent(addon.id) + '/preferences');
        break;
      case 3:
        win.switchToTabHavingURI(addon.optionsURL, true);
        break;
      case 1:
        var windows = Services.wm.getEnumerator(null);
        while (windows.hasMoreElements()) {
          var win2 = windows.getNext();
          if (win2.closed) {
            continue;
          }
          if (win2.document.documentURI == addon.optionsURL) {
            win2.focus();
            return;
          }
        }
        win.openDialog(addon.optionsURL, addon.id, 'chrome,titlebar,toolbar,centerscreen');
    }
  },

  browseDir: function(addon) {
    let dir = Services.dirsvc.get('ProfD', Ci.nsIFile);
    dir.append('extensions');
    dir.append(addon.id + '.xpi');
    dir.launch();
  },

  iconURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABaUlEQVQ4y6WTW0sCQRiG/SEpVBDUVVfphbAEhWAlqYhrLWUlER2IIgrqYkEp6SBmudWiFf0SiSCwpAI7bJnprq6H/sTbGhJiEyt28fAN7zfz8DHDaABo/oPqBpovX7j4T1gOS6dNCcYiZbhOSrCHi2hugqNCwskVYNmXbxoSuPkCN3NWhCdahLLGKCfDcSBjOJiHeTeHPr8EyifCwGb9RMF0RIaHl+E+zoMJ5+AM5WALSBjaEWHayqLXm4GR/YB+Iw2iYIKTMB6WwIRE0EER9r0s+r1pGNZT6F55ReeigPb5F7TOPpMFTDCDkUAGA753GFYFdC08QedJEvkR2DbfzuntFBz+1K2ZFdCz9Ii2qQfo3Pck2MoZpVI/AqtXQAXjchIdk3fQMok/Ib6CaS0Z1c8pdlc8pqXjUOF7AqVSxDvQOq7RKERBi/UKdbDVnK3vkQWWS9Si1vstGIyxCqiBquZUXc429BfU+AL9Tqy8Q2Za8AAAAABJRU5ErkJggg==',

  setStyle: function() {
    this.STYLE = {
      url: Services.io.newURI('data:text/css;charset=UTF-8,' + encodeURIComponent(`
        @-moz-document url('${Services.io.newURI('chrome://browser/content/browser.xhtml')}') {
          .enabling label:after { content: "+" !important; }
          .disabling label:after { content: "-" !important; }
          .uninstalling label:after { content: '!' !important; }
          .noOptions { color: gray; }
          .disabled { color: gray; font-style: italic; }
        }
      `)),
      type: Services.sss.USER_SHEET
    };
  },

  destroy: function() {
    Services.wm.getMostRecentBrowserWindow().CustomizableUI.destroyWidget('eom-button');
    Services.sss.unregisterSheet(this.STYLE.url, this.STYLE.type);
    delete UC.extensionOptionsMenu;
  }
};

UC.extensionOptionsMenu.init();
})();
