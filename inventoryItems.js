const PROP = {
  PAINT: 1,
  FLOAT: 2,
  NAMETAG: 5,
}

function entries (value) {
  if (!value || Array.isArray(value)) return []
  return Object.entries(value)
}

function mergePages (pages, key) {
  return Object.assign({}, ...pages.map((page) => page[key] || {}))
}

function propValue (properties, id, field) {
  const match = (properties || []).find((item) => item.propertyid === id)
  return match?.[field] ?? ''
}

export function steamImageUrl (iconUrl) {
  if (!iconUrl) return ''
  return 'https://community.akamai.steamstatic.com/economy/image/' + iconUrl
}

export function flattenBag (raw, bag) {
  const pages = Array.isArray(raw) ? raw : [raw]
  const inventory = mergePages(pages, 'rgInventory')
  const descriptions = mergePages(pages, 'rgDescriptions')
  const properties = mergePages(pages, 'rgAssetProperties')
  const assets = entries(inventory)
  const ids = assets.length
    ? assets.map(([id, asset]) => [id, asset])
    : Object.keys(properties).map((id) => [id, { id }])

  return ids.map(([assetId, asset]) => {
    const desc = descriptions[(asset.classid || '') + '_' + (asset.instanceid || '0')] || {}
    const props = properties[assetId] || []
    return {
      bag,
      assetId: String(assetId),
      name: desc.market_name || desc.name || 'Asset ' + assetId,
      iconUrl: steamImageUrl(desc.icon_url),
      classid: asset.classid ? String(asset.classid) : '',
      float: String(propValue(props, PROP.FLOAT, 'float_value')),
      paintIndex: String(propValue(props, PROP.PAINT, 'int_value')),
      nameTag: String(propValue(props, PROP.NAMETAG, 'string_value')),
    }
  })
}
