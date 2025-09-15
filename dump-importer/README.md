## Import webrtc-internal and rtcstats dumps
Chrome webrtc-internals page is tremendously useful but lacks the ability to reimport the exported dumps.
This web page provides that functionality and is co-developed with the Chromium page.
It also uses a [better library for graphs](http://www.highcharts.com/) that adds the ability to zoom into regions of interest.

This page also supports importing dumps from the rtcstats-js library that is part of this repository.

See [rtcstats.com](https://www.rtcstats.com) for a freely-usable hosted version with a much better user experience.

## What do all these parameters mean?

I teamed up with [Tsahi Levent-Levi](https://bloggeek.me/) to describe the parameters from webrtc-internals as a series of blog posts:
* [Everything you wanted to know about webrtc-internals and getStats](https://bloggeek.me/webrtc-internals/)

[See also the 2017 version of that](http://testrtc.com/webrtc-internals-parameters/).

## License
MIT

Note that the (awesome) Highcharts library used for plots may need a license. See http://shop.highsoft.com/faq/non-commercial
