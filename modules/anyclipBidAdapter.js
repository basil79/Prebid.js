import {registerBidder} from '../src/adapters/bidderFactory.js';
import {BANNER} from '../src/mediaTypes.js';
import {deepAccess, logInfo} from '../src/utils.js';
import {config} from '../src/config.js';

const BIDDER_CODE = 'anyclip';
const ENDPOINT_URL = 'https://prebid.anyclip.com';
const DEFAULT_CURRENCY = 'USD';
const NET_REVENUE = false;

let pubTag = null;

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [BANNER],
  isBidRequestValid: (bid) => {
    // publisherId and supplyTagId should be set
    if (!(bid && bid.params && bid.params.publisherId && bid.params.supplyTagId)) {
      return false;
    }
    return true;
  },
  buildRequests: (validBidRequests, bidderRequest) => {
    const bidRequest = validBidRequests[0];
    let refererInfo;
    if (bidderRequest && bidderRequest.refererInfo) {
      refererInfo = bidderRequest.refererInfo;
    }

    const timeout = bidderRequest.timeout;
    const timeoutAdjustment = timeout - ((20 / 100) * timeout); // timeout adjustment - 20%

    if (isPubTagAvailable()) {
      if (!pubTag) {
        pubTag = window._anyclip.pubTag;
      }
      // Options
      const options = {
        publisherId: bidRequest.params.publisherId,
        supplyTagId: bidRequest.params.supplyTagId,
        url: refererInfo.page,
        domain: refererInfo.domain,
        prebidTimeout: timeoutAdjustment,
        gpid: bidRequest.adUnitCode,
        ext: {
          transactionId: bidRequest.transactionId
        },
        sizes: bidRequest.sizes.map((size) => {
          return {width: size[0], height: size[1]}
        })
      }
      // Floor
      const floor = parseFloat(deepAccess(bidRequest, 'params.floor'));
      if (!isNaN(floor)) {
        options.ext.floor = floor;
      }
      // Supply Chain (Schain)
      if (bidRequest?.schain) {
        options.schain = bidRequest.schain
      }
      // GDPR & Consent (EU)
      if (bidderRequest?.gdprConsent) {
        options.gdpr = (bidderRequest.gdprConsent.gdprApplies ? 1 : 0);
        options.consent = bidderRequest.gdprConsent.consentString;
      }
      // GPP
      if (bidderRequest?.gppConsent?.gppString) {
        options.gpp = {
          gppVersion: bidderRequest.gppConsent.gppVersion,
          sectionList: bidderRequest.gppConsent.sectionList,
          applicableSections: bidderRequest.gppConsent.applicableSections,
          gppString: bidderRequest.gppConsent.gppString
        }
      }
      // CCPA (US Privacy)
      if (bidderRequest?.uspConsent) {
        options.usPrivacy = bidderRequest.uspConsent;
      }
      // COPPA
      if (config.getConfig('coppa') === true) {
        options.coppa = 1;
      }
      // Eids
      if (bidRequest?.userIdAsEids) {
        const eids = bidRequest.userIdAsEids;
        if (eids && eids.length) {
          options.eids = eids;
        }
      }

      // Request bids
      const requestBidsPromise = pubTag.requestBids(options);
      if (requestBidsPromise !== undefined) {
        requestBidsPromise
          .then(() => {
            logInfo('PubTag requestBids > DONE');
          })
          .catch((err) => {
            logInfo('PubTag requestBids > ERROR', err);
          });
      }

      // Request
      const payload = {
        tmax: timeoutAdjustment
      }

      return {
        method: 'GET',
        url: ENDPOINT_URL,
        data: payload,
        bidRequest
      }
    }
  },
  interpretResponse: (serverResponse, { bidRequest }) => {
    const body = serverResponse.body || serverResponse;
    const bids = [];

    if (isPubTagAvailable() && pubTag) {
      const bidResponse = pubTag.getBids(bidRequest.transactionId);
      if (bidResponse) {
        const { adServer } = bidResponse;
        if (adServer) {
          bids.push({
            requestId: bidRequest.bidId,
            creativeId: adServer.bid.creativeId,
            cpm: bidResponse.cpm,
            width: adServer.bid.width,
            height: adServer.bid.height,
            currency: adServer.bid.currency || DEFAULT_CURRENCY,
            netRevenue: NET_REVENUE,
            ttl: adServer.bid.ttl,
            ad: adServer.bid.ad,
            meta: adServer.bid.meta
          });
        }
      }
    }

    return bids;
  },
  onBidWon: (bid) => {
    if (isPubTagAvailable() && pubTag) {
      pubTag.bidWon(bid);
    }
  }
}

const isPubTagAvailable = () => {
  return !!(window._anyclip && window._anyclip.PubTag);
}

registerBidder(spec);
