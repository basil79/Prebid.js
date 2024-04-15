import {VIDEO} from '../src/mediaTypes.js';
import { ortbConverter } from '../libraries/ortbConverter/converter.js';
import {registerBidder} from '../src/adapters/bidderFactory.js';
import {deepAccess, deepSetValue} from '../src/utils.js';

const BIDDER_CODE = 'inmobi';
const ENDPOINT_URL = 'https://api.w.inmobi.com/showad/openrtb/bidder/prebid';
const DEFAULT_CURRENCY = 'USD';
const NET_REVENUE = false;

const converter = ortbConverter({
  context: {
    netRevenue: NET_REVENUE, // or false if your adapter should set bidResponse.netRevenue = false
    ttl: 300 // default bidResponse.ttl (when not specified in ORTB response.seatbid[].bid[].exp)
  }
});

export const spec = {
  code: BIDDER_CODE,
  gvlid: 333,
  supportedMediaTypes: [VIDEO],
  isBidRequestValid: (bid) => {
    return !!(bid.params && bid.params.plc);
  },
  buildRequests: (validBidRequests, bidderRequest) => {
    const data = converter.toORTB({validBidRequests, bidderRequest});
    deepSetValue(data.imp[0], 'ext.bidder.plc', validBidRequests[0].params.plc);
    return {
      method: 'POST',
      url: ENDPOINT_URL,
      data,
      bidRequest: validBidRequests[0]
    };
    /*
    return validBidRequests.map(bidRequest => {

      let refererInfo;
      if (bidderRequest && bidderRequest.refererInfo) {
        refererInfo = bidderRequest.refererInfo;
      }

      let payload = {
        id: bidRequest.transactionId,
        at: 1,
        cur: [DEFAULT_CURRENCY],
        imp: [{
          id: bidRequest.adUnitCode,
          secure: 1,
          video: deepAccess(bidRequest, 'mediaTypes.video') || {},
          ext: {
            bidder: {
              plc: bidRequest.params.plc
            }
          }
        }],
        site: {
          page: refererInfo.page,
          ref: refererInfo.ref,
          domain: refererInfo.domain,
          publisher: {}
        },
        device: {
          ua: navigator.userAgent,
          js: 1,
          dnt: (navigator.doNotTrack == 'yes' || navigator.doNotTrack == '1' || navigator.msDoNotTrack == '1') ? 1 : 0,
          h: screen.height,
          w: screen.width,
          language: navigator.language
        },
        source: {
          tid: bidRequest.transactionId
        },
        tmax: bidderRequest.timeout,
        user: {},
        ext: {}
      };

      // Size
      let size = [];
      if (Array.isArray(deepAccess(bidRequest, 'mediaTypes.video.playerSize')) && bidRequest.mediaTypes.video.playerSize.length === 1) {
        size = bidRequest.mediaTypes.video.playerSize[0];
      } else if (Array.isArray(bidRequest.sizes) && bidRequest.sizes.length > 0 && Array.isArray(bidRequest.sizes[0]) && bidRequest.sizes[0].length > 1) {
        size = bidRequest.sizes[0];
      }
      if (size.length > 0) {
        payload.imp[0].video.w = size[0];
        payload.imp[0].video.h = size[1];
      }

      // Floor
      let bidFloor = parseFloat(deepAccess(bidRequest, 'params.bidfloor'));
      if (!isNaN(bidFloor)) {
        payload.imp[0].bidfloor = bidFloor;
      }

      // Merge the device from config.getConfig('device')
      if (typeof config.getConfig('device') === 'object') {
        payload.device = Object.assign(payload.device, config.getConfig('device'));
      }

      // Supply Chain (Schain)
      if (bidRequest.schain) {
        deepSetValue(payload, 'source.ext.schain', bidRequest.schain);
      }

      // GDPR & Consent (EU)
      if (bidderRequest && bidderRequest.gdprConsent) {
        deepSetValue(payload, 'user.ext.consent', bidderRequest.gdprConsent.consentString);
        deepSetValue(payload, 'regs.ext.gdpr', (bidderRequest.gdprConsent.gdprApplies ? 1 : 0));
      }

      // CCPA (US Privacy)
      if (bidderRequest && bidderRequest.uspConsent) {
        deepSetValue(payload, 'regs.ext.us_privacy', bidderRequest.uspConsent);
      }

      // User Ids
      const eids = deepAccess(bidderRequest, 'bids.0.userIdAsEids');
      if (eids && eids.length) {
        deepSetValue(payload, 'user.ext.eids', eids);
      }

      // COPPA
      if (config.getConfig('coppa') === true) {
        deepSetValue(payload, 'regs.coppa', 1);
      }

      return {
        method: 'POST',
        url: ENDPOINT_URL,
        data: JSON.stringify(payload),
        bidRequest
      };
    });
     */
  },
  interpretResponse: function(serverResponse, { bidRequest }) {
    serverResponse = serverResponse.body;

    const bids = [];
    // Check overall response
    if (!serverResponse || typeof serverResponse !== 'object') {
      return bids;
    }

    // Video response
    if (serverResponse.seatbid) {
      serverResponse.seatbid.forEach(seatbid => {
        (seatbid.bid || []).forEach(bid => {
          let bidObject = {
            requestId: bidRequest.bidId,
            cpm: bid.price || 0,
            currency: serverResponse.cur || DEFAULT_CURRENCY,
            creativeId: bid.crid || bid.id,
            bidderCode: BIDDER_CODE, // seatbid.seat,
            ttl: 300,
            ad: bid.adm,
            netRevenue: NET_REVENUE,
            width: bid.w || deepAccess(bidRequest, 'mediaTypes.video.w') || deepAccess(bidRequest, 'params.video.playerWidth'),
            height: bid.h || deepAccess(bidRequest, 'mediaTypes.video.h') || deepAccess(bidRequest, 'params.video.playerHeight'),
            mediaType: VIDEO
          };

          if (bid.adm) {
            bidObject.vastXml = bid.adm;
          }

          if (bid.id) {
            bidObject.seatBidId = bid.id;
          }

          if (bid.adomain) {
            deepSetValue(bidObject, 'meta.advertiserDomains', Array.isArray(bid.adomain) ? bid.adomain : [bid.adomain]);
          }

          bids.push(bidObject);
        });
      });

      return bids;
    }
  }
};

registerBidder(spec);
