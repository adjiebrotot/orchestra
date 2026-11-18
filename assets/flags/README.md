# Flag artwork

This folder holds the SVG files of the flags whose emblems the app does not draw itself
(`scene/country-flags.ts`, design 4.5). The app loads a file only when a banner, a flag, or a
prop shows its flag, so the first download holds none of them (design 7.2). The code crops the
emblem from the file and draws it on its own field. Thus the emblem keeps its form at any
aspect and can stay upright on a vertical banner.

Each file is the current revision of Wikimedia Commons on 18 November 2026. Each file page gives
the license "Public domain". The SHA-1 of each
file is the same as the SHA-1 that the Commons API gives for that revision.

| File | Flag | Source | Revision | Bytes | SHA-256 |
|---|---|---|---|---|---|
| `ar.svg` | Argentina | <https://commons.wikimedia.org/wiki/File:Flag_of_Argentina.svg> | 2012-09-12 | 4,994 | `dafb5bc6543c59249be9c7dec2298eaeaa1fe7805a62754990315cc6db93b2f3` |
| `bn.svg` | Brunei | <https://commons.wikimedia.org/wiki/File:Flag_of_Brunei.svg> | 2026-03-31 | 31,244 | `11c704ce4271bcbddd1c372cb6dd457a278c51ce7db7ad98ab5f5c5517695dd6` |
| `br.svg` | Brazil | <https://commons.wikimedia.org/wiki/File:Flag_of_Brazil.svg> | 2024-08-09 | 4,243 | `041479c6a955990d32c8e45b7283afcd62eacc3592eba9bbf0162299ad77ff01` |
| `ca.svg` | Canada | <https://commons.wikimedia.org/wiki/File:Flag_of_Canada.svg> | 2019-03-18 | 699 | `95b9eb0eaa176454215088c005a07df3df7564093b9f1d6475bb1fd61a16bb10` |
| `es.svg` | Spain | <https://commons.wikimedia.org/wiki/File:Flag_of_Spain.svg> | 2024-01-15 | 155,900 | `af0b860424a9bd6af63dce070d7f7cb4c7b490c6269fc1cd4f35c45679a20500` |
| `ir.svg` | Iran | <https://commons.wikimedia.org/wiki/File:Flag_of_Iran.svg> | 2025-06-25 | 2,218 | `c1d6eb64f7060fb362ad8efd0205cdd37c7443fa1f009b9882feede56022009c` |
| `kh.svg` | Cambodia | <https://commons.wikimedia.org/wiki/File:Flag_of_Cambodia.svg> | 2026-04-19 | 10,374 | `d3e7df02fdb48d08e6784f4c3eead2c026fe458a8cdea8d09c78cded471eac35` |
| `kz.svg` | Kazakhstan | <https://commons.wikimedia.org/wiki/File:Flag_of_Kazakhstan.svg> | 2023-04-24 | 9,668 | `bcf331e5a92785976aabe77aeac25de912e97d4e20557c521359e1033d1450af` |
| `mn.svg` | Mongolia | <https://commons.wikimedia.org/wiki/File:Flag_of_Mongolia.svg> | 2022-10-24 | 1,526 | `b7ccaa99a79fe613cb0a8953ef2f49b25f5e56c5c2b05b5725627ff01d60af6f` |
| `mx.svg` | Mexico | <https://commons.wikimedia.org/wiki/File:Flag_of_Mexico.svg> | 2026-05-03 | 117,180 | `bcfebaa9d94827919e65c5414e4ee35a076f89520a1b57d75e0949e1ca81c3b9` |
| `ph.svg` | Philippines | <https://commons.wikimedia.org/wiki/File:Flag_of_the_Philippines.svg> | 2024-08-17 | 892 | `b0010e0b5f5945506e98b76f3469faf964c1ce30de75673186d303f9112b5454` |
| `pt.svg` | Portugal | <https://commons.wikimedia.org/wiki/File:Flag_of_Portugal.svg> | 2024-06-01 | 13,091 | `20ddeda8a3c2960f6d8d7cf88cec827aad537143431a0828e789f55d0cd923ce` |
| `sa.svg` | Saudi Arabia | <https://commons.wikimedia.org/wiki/File:Flag_of_Saudi_Arabia.svg> | 2023-03-23 | 28,593 | `b0b36326e3e5b74624ee8b5de8273ea00f7bbe9b5ba0da6250cbe7b3c637505e` |
| `va.svg` | Vatican City | <https://commons.wikimedia.org/wiki/File:Flag_of_Vatican_City_(2023%E2%80%93present).svg> | 2024-10-17 | 142,914 | `59ac80ec65dde9fbbf6456609baa583218bf4290bd2a50b2616c354b1660724e` |

The flag of ASEAN is not on Wikimedia Commons with a free license, so the code draws it from a
reference image.
