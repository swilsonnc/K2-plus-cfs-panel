# This is a panel that I created to monitor and semi-control your cfs from mainsal on the K2 plus.

# Please use this at your own risk!

To install this you need to upload the cfs-panel.js and index.html into your /usr/share/mainsail folder on your printer via SSH overwriting the existing files (make backup of index.html first)

Alternatively you can edit the index.html and add the following right under the ```<div id="app"></div>``` line and save

```bash
<script src="/cfs-panel.js" defer></script>
```

This will create the cfs panel on the mainsail pages but it will be static at top left and cannot be moved too any other position on the dashboard.

The dryer power and timer option is for a custom dryer I have in my cfs that is on a smart plug and will not work for your use most likely.

<picture>
  <a href="https://github.com/swilsonnc/K2-plus-cfs-panel/blob/main/image.jpg" target=_new><img src="https://github.com/swilsonnc/K2-plus-cfs-panel/blob/main/image.jpg" alt="" style="width:480px;"></a>
</picture>


The idea and credits go to DaviBe92 who's repo is at https://github.com/DaviBe92/k2-websocket-re
