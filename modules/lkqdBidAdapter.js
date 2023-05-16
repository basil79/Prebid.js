import {registerBidder} from '../src/adapters/bidderFactory.js';
import {deepAccess, logError, logWarn} from '../src/utils.js';
import {VIDEO} from '../src/mediaTypes.js';

const BIDDER_CODE = 'lkqd';
const BID_TTL_DEFAULT = 300;
const ENDPOINT = 'https://v.lkqd.net/ad';

const PARAM_OUTPUT_DEFAULT = 'vast';
const PARAM_EXECUTION_DEFAULT = 'any';
const PARAM_SUPPORT_DEFAULT = 'html5';
const PARAM_PLAYINIT_DEFAULT = 'auto';
const PARAM_VOLUME_DEFAULT = '100';

function _validateId(id) {
  if (id && typeof id !== 'undefined' && parseInt(id) > 0) {
    return true;
  }

  return false;
}

function isBidRequestValid(bidRequest) {
  if (bidRequest.bidder === BIDDER_CODE && typeof bidRequest.params !== 'undefined') {
    if (_validateId(bidRequest.params.siteId) && _validateId(bidRequest.params.placementId)) {
      return true;
    }
  }

  return false;
}

function serializeSupplyChain(schain) {
  var keys = 'asi sid hp rid name domain'.split(' ');
  return schain.ver + ',' + schain.complete + '!' + schain.nodes.map(function(el) {
      return keys.map(function(key) {
          return el[key] ? encodeURIComponent(el[key]) : ''
        }
      ).join(',')
    }
  ).join('!')
}

function buildRequests(validBidRequests, bidderRequest) {
  let bidRequests = [];

  for (let i = 0; i < validBidRequests.length; i++) {
    let bidRequest = validBidRequests[i];

    let sizes = [];
    // if width/height not provided to the ad unit for some reason then attempt request with default 640x480 size
    let bidRequestSizes = bidRequest.sizes;
    let bidRequestDeepSizes = deepAccess(bidRequest, 'mediaTypes.video.playerSize');
    if ((!bidRequestSizes || !bidRequestSizes.length) && (!bidRequestDeepSizes || !bidRequestDeepSizes.length)) {
      logWarn('Warning: Could not find valid width/height parameters on the provided adUnit');
      sizes = [[640, 480]];
    }

    // sizes: [640,480] instead of sizes: [[640,480]] so need to handle single-layer array as well as nested arrays
    if (bidRequestSizes && bidRequestSizes.length > 0) {
      sizes = bidRequestSizes;
      if (bidRequestSizes.length === 2 && typeof bidRequestSizes[0] === 'number' && typeof bidRequestSizes[1] === 'number') {
        sizes = [bidRequestSizes];
      }
    } else if (bidRequestDeepSizes && bidRequestDeepSizes.length > 0) {
      sizes = bidRequestDeepSizes;
      if (bidRequestDeepSizes.length === 2 && typeof bidRequestDeepSizes[0] === 'number' && typeof bidRequestDeepSizes[1] === 'number') {
        sizes = [bidRequestDeepSizes];
      }
    }

    for (let j = 0; j < sizes.length; j++) {
      let size = sizes[j];
      let playerWidth;
      let playerHeight;
      if (size && size.length === 2) {
        playerWidth = size[0];
        playerHeight = size[1];
      } else {
        logWarn('Warning: Could not determine width/height from the provided adUnit');
      }

      let sspData = {};

      // required parameters
      sspData.pid = bidRequest.params.placementId;
      sspData.sid = bidRequest.params.siteId;
      sspData.prebid = true;

      // optional parameters
      if (bidRequest.params.hasOwnProperty('output') && bidRequest.params.output != null) {
        sspData.output = bidRequest.params.output;
      } else {
        sspData.output = PARAM_OUTPUT_DEFAULT;
      }
      if (bidRequest.params.hasOwnProperty('execution') && bidRequest.params.execution != null) {
        sspData.execution = bidRequest.params.execution;
      } else {
        sspData.execution = PARAM_EXECUTION_DEFAULT;
      }
      if (bidRequest.params.hasOwnProperty('support') && bidRequest.params.support != null) {
        sspData.support = bidRequest.params.support;
      } else {
        sspData.support = PARAM_SUPPORT_DEFAULT;
      }
      if (bidRequest.params.hasOwnProperty('playinit') && bidRequest.params.playinit != null) {
        sspData.playinit = bidRequest.params.playinit;
      } else {
        sspData.playinit = PARAM_PLAYINIT_DEFAULT;
      }
      if (bidRequest.params.hasOwnProperty('volume') && bidRequest.params.volume != null) {
        sspData.volume = bidRequest.params.volume;
      } else {
        sspData.volume = PARAM_VOLUME_DEFAULT;
      }
      if (playerWidth) {
        sspData.width = playerWidth;
      }
      if (playerHeight) {
        sspData.height = playerHeight;
      }
      if (bidRequest.params.hasOwnProperty('vpaidmode') && bidRequest.params.vpaidmode != null) {
        sspData.vpaidmode = bidRequest.params.vpaidmode;
      }
      if (bidRequest.params.hasOwnProperty('appname') && bidRequest.params.appname != null) {
        sspData.appname = bidRequest.params.appname;
      }
      if (bidRequest.params.hasOwnProperty('bundleid') && bidRequest.params.bundleid != null) {
        sspData.bundleid = bidRequest.params.bundleid;
      }
      if (bidRequest.params.hasOwnProperty('aid') && bidRequest.params.aid != null) {
        sspData.aid = bidRequest.params.aid;
      }
      if (bidRequest.params.hasOwnProperty('idfa') && bidRequest.params.idfa != null) {
        sspData.idfa = bidRequest.params.idfa;
      }

      // GDPR
      if (bidderRequest.gdprConsent) {
        sspData.gdpr = bidderRequest.gdprConsent.gdprApplies; // ? 1 : 0;
        sspData.gdprcs = bidderRequest.gdprConsent.consentString;
      }
      // US Privacy
      if (bidderRequest.uspConsent) {
        sspData.usp = bidderRequest.uspConsent
      }

      if (bidRequest.params.hasOwnProperty('flrd') && bidRequest.params.flrd != null) {
        sspData.flrd = bidRequest.params.flrd;
      }
      if (bidRequest.params.hasOwnProperty('flrmp') && bidRequest.params.flrmp != null) {
        sspData.flrmp = bidRequest.params.flrmp;
      }

      // Supply Chain
      if (bidRequest.schain) {
        sspData.schain = serializeSupplyChain(bidRequest.schain)
      }

      if (bidRequest.params.hasOwnProperty('placement') && bidRequest.params.placement != null) {
        sspData.placement = bidRequest.params.placement;
      }
      if (bidRequest.params.hasOwnProperty('timeout') && bidRequest.params.timeout != null) {
        sspData.timeout = bidRequest.params.timeout;
      }
      if (bidRequest.params.hasOwnProperty('pageurl') && bidRequest.params.pageurl != null) {
        sspData.pageurl = bidRequest.params.pageurl;
      } else if (bidderRequest && bidderRequest.refererInfo) {
        sspData.pageurl = encodeURIComponent(encodeURIComponent(bidderRequest.refererInfo.referer));
      }
      if (bidRequest.params.hasOwnProperty('contentId') && bidRequest.params.contentId != null) {
        sspData.contentid = bidRequest.params.contentId;
      }
      if (bidRequest.params.hasOwnProperty('contentTitle') && bidRequest.params.contentTitle != null) {
        sspData.contenttitle = bidRequest.params.contentTitle;
      }
      if (bidRequest.params.hasOwnProperty('contentLength') && bidRequest.params.contentLength != null) {
        sspData.contentlength = bidRequest.params.contentLength;
      }
      if (bidRequest.params.hasOwnProperty('contentUrl') && bidRequest.params.contentUrl != null) {
        sspData.contenturl = bidRequest.params.contentUrl;
      }

      // User agent
      sspData.ua = navigator.userAgent;
      sspData.js = 1;
      // Do not track
      sspData.dnt = (navigator.doNotTrack == 'yes' || navigator.doNotTrack == '1' || navigator.msDoNotTrack == '1') ? 1 : 0;

      // random number to prevent caching
      sspData.rnd = Math.floor(Math.random() * 999999999);

      // Prebid.js required properties
      sspData.bidId = bidRequest.bidId;
      sspData.bidWidth = playerWidth;
      sspData.bidHeight = playerHeight;

      bidRequests.push({
        method: 'GET',
        url: ENDPOINT,
        data: Object.keys(sspData).map(function (key) { return key + '=' + sspData[key] }).join('&')
      });
    }
  }

  return bidRequests;
}

function interpretResponse(serverResponse, bidRequest) {
  let bidResponses = [];
  if (serverResponse && serverResponse.body) {
    if (serverResponse.error) {
      logError('Error: ' + serverResponse.error);
      return bidResponses;
    } else {
      try {
        let bidResponse = {};
        if (bidRequest && bidRequest.data && typeof bidRequest.data === 'string') {
          let sspData;
          let sspBidId;
          let sspBidWidth;
          let sspBidHeight;
          if (window.URLSearchParams) {
            sspData = new URLSearchParams(bidRequest.data);
            sspBidId = sspData.get('bidId');
            sspBidWidth = sspData.get('bidWidth');
            sspBidHeight = sspData.get('bidHeight');
          } else {
            if (bidRequest.data.indexOf('bidId=') >= 0) {
              sspBidId = bidRequest.data.substr(bidRequest.data.indexOf('bidId=') + 6, bidRequest.data.length);
              sspBidId = sspBidId.split('&')[0];
            }
            if (bidRequest.data.indexOf('bidWidth=') >= 0) {
              sspBidWidth = bidRequest.data.substr(bidRequest.data.indexOf('bidWidth=') + 9, bidRequest.data.length);
              sspBidWidth = sspBidWidth.split('&')[0];
            }
            if (bidRequest.data.indexOf('bidHeight=') >= 0) {
              sspBidHeight = bidRequest.data.substr(bidRequest.data.indexOf('bidHeight=') + 10, bidRequest.data.length);
              sspBidHeight = sspBidHeight.split('&')[0];
            }
          }

          if (sspBidId) {
            let sspXmlString = serverResponse.body;
            let sspXml = new window.DOMParser().parseFromString(sspXmlString, 'text/xml');
            if (sspXml && sspXml.getElementsByTagName('parsererror').length == 0) {
              bidResponse.requestId = sspBidId;
              bidResponse.bidderCode = BIDDER_CODE;
              bidResponse.ad = '';
              bidResponse.cpm = parseFloat(sspXml.getElementsByTagName('Pricing')[0].textContent);
              bidResponse.width = sspBidWidth;
              bidResponse.height = sspBidHeight;
              bidResponse.ttl = BID_TTL_DEFAULT;
              bidResponse.creativeId = sspXml.getElementsByTagName('Ad')[0].getAttribute('id');
              bidResponse.currency = sspXml.getElementsByTagName('Pricing')[0].getAttribute('currency');
              bidResponse.netRevenue = true;
              bidResponse.vastXml = sspXmlString;
              bidResponse.mediaType = VIDEO;

              bidResponses.push(bidResponse);
            } else {
              logError('Error: Server response contained invalid XML');
            }
          } else {
            logError('Error: Could not associate bid request to server response');
          }
        } else {
          logError('Error: Could not associate bid request to server response');
        }
      } catch (e) {
        logError('Error: Could not interpret server response');
      }
    }
  } else {
    logError('Error: No server response or server response was empty for the requested URL');
  }

  return bidResponses;
}

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [VIDEO],
  isBidRequestValid,
  buildRequests,
  interpretResponse
}

registerBidder(spec);
/*
import { logError, _each, generateUUID, buildUrl } from '../src/utils.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import { config } from '../src/config.js';
import { VIDEO } from '../src/mediaTypes.js';

const BIDDER_CODE = 'lkqd';
const BID_TTL_DEFAULT = 300;
const MIMES_TYPES = ['application/x-mpegURL', 'video/mp4', 'video/H264'];
const PROTOCOLS = [1, 2, 3, 4, 5, 6, 7, 8];

const PARAM_VOLUME_DEFAULT = '100';
const DEFAULT_SIZES = [[640, 480]];

function calculateSizes(VIDEO_BID, bid) {
  const userProvided = bid.sizes && Array.isArray(bid.sizes) ? (Array.isArray(bid.sizes[0]) ? bid.sizes : [bid.sizes]) : DEFAULT_SIZES;
  const preBidProvided = VIDEO_BID.playerSize && Array.isArray(VIDEO_BID.playerSize) ? (Array.isArray(VIDEO_BID.playerSize[0]) ? VIDEO_BID.playerSize : [VIDEO_BID.playerSize]) : null;

  return preBidProvided || userProvided;
}

function isSet(value) {
  return value != null;
}

export const spec = {
  code: BIDDER_CODE,
  aliases: [],
  supportedMediaTypes: [VIDEO],
  isBidRequestValid: function(bid) {
    return bid.bidder === BIDDER_CODE && bid.params && Object.keys(bid.params).length > 0 &&
      ((isSet(bid.params.publisherId) && parseInt(bid.params.publisherId) > 0) || (isSet(bid.params.placementId) && parseInt(bid.params.placementId) > 0)) &&
      bid.params.siteId != null;
  },
  buildRequests: function(validBidRequests, bidderRequest) {
    const BIDDER_REQUEST = bidderRequest || {};
    const serverRequestObjects = [];
    const UTC_OFFSET = new Date().getTimezoneOffset();
    const UA = navigator.userAgent;
    const USP = BIDDER_REQUEST.uspConsent || null;
    // TODO: does the fallback make sense here?
    const REFERER = BIDDER_REQUEST?.refererInfo?.domain || window.location.host;
    const BIDDER_GDPR = BIDDER_REQUEST.gdprConsent && BIDDER_REQUEST.gdprConsent.gdprApplies ? 1 : null;
    const BIDDER_GDPRS = BIDDER_REQUEST.gdprConsent && BIDDER_REQUEST.gdprConsent.consentString ? BIDDER_REQUEST.gdprConsent.consentString : null;

    _each(validBidRequests, (bid) => {
      const DOMAIN = bid.params.pageurl || REFERER;
      const GDPR = BIDDER_GDPR || bid.params.gdpr || null;
      const GDPRS = BIDDER_GDPRS || bid.params.gdprs || null;
      const DNT = bid.params.dnt || null;
      const BID_FLOOR = bid.params.flrd > bid.params.flrmp ? bid.params.flrd : bid.params.flrmp;
      const VIDEO_BID = bid.video ? bid.video : {};

      const requestData = {
        id: generateUUID(),
        imp: [],
        site: {
          domain: DOMAIN
        },
        device: {
          ua: UA,
          geo: {
            utcoffset: UTC_OFFSET
          }
        },
        user: {
          ext: {}
        },
        test: 0,
        at: 2,
        tmax: bid.params.timeout || config.getConfig('bidderTimeout') || 100,
        cur: ['USD'],
        regs: {
          ext: {
            us_privacy: USP
          }
        }
      };

      if (isSet(DNT)) {
        requestData.device.dnt = DNT;
      }

      if (isSet(config.getConfig('coppa'))) {
        requestData.regs.coppa = config.getConfig('coppa') === true ? 1 : 0;
      }

      if (isSet(GDPR)) {
        requestData.regs.ext.gdpr = GDPR;
        requestData.regs.ext.gdprs = GDPRS;
      }

      if (isSet(bid.params.aid) || isSet(bid.params.appname) || isSet(bid.params.bundleid)) {
        requestData.app = {
          id: bid.params.aid,
          name: bid.params.appname,
          bundle: bid.params.bundleid
        };

        if (bid.params.contentId) {
          requestData.app.content = {
            id: bid.params.contentId,
            title: bid.params.contentTitle,
            len: bid.params.contentLength,
            url: bid.params.contentUrl
          };
        }
      }

      if (isSet(bid.params.idfa) || isSet(bid.params.aid)) {
        requestData.device.ifa = bid.params.idfa || bid.params.aid;
      }

      if (bid.schain) {
        requestData.source = {
          ext: {
            schain: bid.schain
          }
        };
      } else if (bid.params.schain) {
        const section = bid.params.schain.split('!');
        const verComplete = section[0].split(',');
        const node = section[1].split(',');

        requestData.source = {
          ext: {
            schain: {
              validation: 'strict',
              config: {
                ver: verComplete[0],
                complete: parseInt(verComplete[1]),
                nodes: [
                  {
                    asi: decodeURIComponent(node[0]),
                    sid: decodeURIComponent(node[1]),
                    hp: parseInt(node[2]),
                    rid: decodeURIComponent(node[3]),
                    name: decodeURIComponent(node[4]),
                    domain: decodeURIComponent(node[5])
                  }
                ]
              }
            }
          }
        };
      }

      _each(calculateSizes(VIDEO_BID, bid), (sizes) => {
        const impObj = {
          id: generateUUID(),
          displaymanager: bid.bidder,
          bidfloor: BID_FLOOR,
          video: {
            mimes: VIDEO_BID.mimes || MIMES_TYPES,
            protocols: VIDEO_BID.protocols || PROTOCOLS,
            nvol: bid.params.volume || PARAM_VOLUME_DEFAULT,
            w: sizes[0],
            h: sizes[1],
            skip: VIDEO_BID.skip || 0,
            playbackmethod: VIDEO_BID.playbackmethod || [1],
            placement: (bid.params.execution === 'outstream' || VIDEO_BID.context === 'outstream') ? 5 : 1,
            ext: {
              lkqdcustomparameters: {}
            },
          },
          bidfloorcur: 'USD',
          secure: 1
        };

        for (let k = 1; k <= 40; k++) {
          if (bid.params.hasOwnProperty(`c${k}`) && bid.params[`c${k}`]) {
            impObj.video.ext.lkqdcustomparameters[`c${k}`] = bid.params[`c${k}`];
          }
        }

        requestData.imp.push(impObj);
      });

      serverRequestObjects.push({
        method: 'POST',
        url: buildUrl({
          protocol: 'https',
          hostname: 'rtb.lkqd.net',
          pathname: '/ad',
          search: {
            pid: bid.params.publisherId || bid.params.placementId,
            sid: bid.params.siteId,
            output: 'rtb',
            prebid: true
          }
        }),
        data: requestData
      });
    });

    return serverRequestObjects;
  },
  interpretResponse: function(serverResponse, bidRequest) {
    const serverBody = serverResponse.body;
    const bidResponses = [];

    if (serverBody && serverBody.seatbid) {
      _each(serverBody.seatbid, (seatbid) => {
        _each(seatbid.bid, (bid) => {
          if (bid.price > 0) {
            const bidResponse = {
              requestId: bidRequest.id,
              creativeId: bid.crid,
              cpm: bid.price,
              width: bid.w,
              height: bid.h,
              currency: serverBody.cur,
              netRevenue: true,
              ttl: BID_TTL_DEFAULT,
              ad: bid.adm,
              meta: {
                advertiserDomains: bid.adomain && Array.isArray(bid.adomain) ? bid.adomain : [],
                mediaType: VIDEO
              }
            };

            bidResponses.push(bidResponse);
          }
        });
      });
    } else {
      logError('Error: No server response or server response was empty for the requested URL');
    }

    return bidResponses;
  }
}

registerBidder(spec);
 */
