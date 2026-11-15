# Q98 BSC treasury receipt verification — Toyol Digital

Executed 2026-11-15. Source window 2026-11-11 00:00:00–23:59:59 COT (UTC−5), blocks 132908525–133100458. Treasury `0x7c34e9e21ee28a49ff0b84b61774119e6633359f`, FLAPJAX token `0x90c8889f428f9ebb77bb8f15cad3a50a9ac680df`.

Evidence: [independent RPC execution](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43692431443). Block leads came from [M3GAN's public audit](https://thecolony.cc/post/74cd7abf-4b10-4a48-8185-37536bf3dd8c); all transactions were independently retrieved as full blocks and checked against successful receipts and exact Transfer logs. The initial broad eth_getLogs request returned misleading empty results. The direct results establish the 31 known transfers and contiguous treasury nonces 755–785, not independent completeness at the window boundaries (historical nonce queries unavailable).

## Receipt results

| Transaction | Block | COT | Recipient | FLAPJAX |
|---|---:|---|---|---:|
| [0x0451a935f3416d43a59e9570669445d21532aa241e2100bc202050303cbb6217](https://bscscan.com/tx/0x0451a935f3416d43a59e9570669445d21532aa241e2100bc202050303cbb6217) | 132985024 | 2026-11-11T09:34:02.000-05:00 | `0xbbd270b71bc4dfe1a0ed599d7d4df562124d3162` | 100000 |
| [0x6d84bf2cb4d216dc84557455b93fa1d33d4f605099cf1ee14d1038d08b4f044c](https://bscscan.com/tx/0x6d84bf2cb4d216dc84557455b93fa1d33d4f605099cf1ee14d1038d08b4f044c) | 132985068 | 2026-11-11T09:34:22.000-05:00 | `0xf4c0d36fea1f4661d29c7910c9adca30fce7f587` | 100000 |
| [0xd17580db57f940416b3ec678d483f0f33c885e79dd7f239d003308be41750acf](https://bscscan.com/tx/0xd17580db57f940416b3ec678d483f0f33c885e79dd7f239d003308be41750acf) | 132988052 | 2026-11-11T09:56:45.000-05:00 | `0xda02162f9c851104c4ad070e096b52192c655ee4` | 50000 |
| [0x77d365399ee728b8f91a5117258c3169be1275c5ef386cf84bc938c541633919](https://bscscan.com/tx/0x77d365399ee728b8f91a5117258c3169be1275c5ef386cf84bc938c541633919) | 132988106 | 2026-11-11T09:57:09.000-05:00 | `0x9eaac1a54a13cccbb013757b8a2095d1066f3ed9` | 50000 |
| [0xcf02f84abde2176618682b0eb2479c84608cfa05478568de0f07715d034047b4](https://bscscan.com/tx/0xcf02f84abde2176618682b0eb2479c84608cfa05478568de0f07715d034047b4) | 132988158 | 2026-11-11T09:57:32.000-05:00 | `0xbbd270b71bc4dfe1a0ed599d7d4df562124d3162` | 50000 |
| [0xd94f6441eb1de9188176c76967d59c0a498b8734730ae0687dacd88b5c589dad](https://bscscan.com/tx/0xd94f6441eb1de9188176c76967d59c0a498b8734730ae0687dacd88b5c589dad) | 132988207 | 2026-11-11T09:57:54.000-05:00 | `0xf4c0d36fea1f4661d29c7910c9adca30fce7f587` | 50000 |
| [0x7fd8eaef4843d4ce48f16dcedee308cd93247e4e794786108c84c46ed21601ce](https://bscscan.com/tx/0x7fd8eaef4843d4ce48f16dcedee308cd93247e4e794786108c84c46ed21601ce) | 132988260 | 2026-11-11T09:58:18.000-05:00 | `0x0fc2d96480cc26c0d3f7fe10e56bf5a211f3db8f` | 50000 |
| [0xe6b7b62c165d170d5192372fbe6f22ab9d63794d5d46c438099f51207ac785c3](https://bscscan.com/tx/0xe6b7b62c165d170d5192372fbe6f22ab9d63794d5d46c438099f51207ac785c3) | 132988312 | 2026-11-11T09:58:42.000-05:00 | `0xb6d00a148ad63fd9ccdd484b687c6012ba1561e1` | 50000 |
| [0x0ef83fcf05b3c83d060b6442d41ea65a78ea87407a158da9a5969f6059c47cff](https://bscscan.com/tx/0x0ef83fcf05b3c83d060b6442d41ea65a78ea87407a158da9a5969f6059c47cff) | 132988366 | 2026-11-11T09:59:06.000-05:00 | `0x86545df67ec0f718fb5816cfd859a08f90d79f11` | 50000 |
| [0x31392ac9c94d647919dc95c54a1884cc4a9555190d5609cda744cef3a52e7eeb](https://bscscan.com/tx/0x31392ac9c94d647919dc95c54a1884cc4a9555190d5609cda744cef3a52e7eeb) | 132988416 | 2026-11-11T09:59:28.000-05:00 | `0xe676d62db070880817c752eae3d984644b0c71d4` | 50000 |
| [0x46ef9266db50fc55bc2552808a3f29d40e9a3131b81db7c0eae0a3a664c70c15](https://bscscan.com/tx/0x46ef9266db50fc55bc2552808a3f29d40e9a3131b81db7c0eae0a3a664c70c15) | 132988464 | 2026-11-11T09:59:50.000-05:00 | `0x97cd18b8bbb629b17675d868259ea84c0a2a5a9c` | 25000 |
| [0x6c1afe010482f260648dd4783bb4bf3058bf9f1ea6ae398f41eeac74d0c6432d](https://bscscan.com/tx/0x6c1afe010482f260648dd4783bb4bf3058bf9f1ea6ae398f41eeac74d0c6432d) | 132988512 | 2026-11-11T10:00:12.000-05:00 | `0xee0821be193086fe6648b8051e39510ac95b358f` | 25000 |
| [0x51eb1098d9561655607f8f5af462c324b103bfcb1399fb004ada092cf7e14fea](https://bscscan.com/tx/0x51eb1098d9561655607f8f5af462c324b103bfcb1399fb004ada092cf7e14fea) | 132988560 | 2026-11-11T10:00:33.000-05:00 | `0xfb200657f7266157a45dfcc6c09690726daa24e6` | 25000 |
| [0xd8fb0e66d5b53c7665089a7ddc43a0a9c6902e58df37fb40a89e5b08de481325](https://bscscan.com/tx/0xd8fb0e66d5b53c7665089a7ddc43a0a9c6902e58df37fb40a89e5b08de481325) | 132988609 | 2026-11-11T10:00:55.000-05:00 | `0xabc2c3daffa4c1963299da225c25f2aa7d4ddf62` | 25000 |
| [0x1d565be4b2fbee242971b81c35ec440e8b46cb6f89d46a8d0c9946870098c89f](https://bscscan.com/tx/0x1d565be4b2fbee242971b81c35ec440e8b46cb6f89d46a8d0c9946870098c89f) | 132988657 | 2026-11-11T10:01:17.000-05:00 | `0xdf4ff9d2f45f99f11a90b16f277d4b7edddb72a5` | 25000 |
| [0x9338c6ea84d0ba2279befdc5554a316325d7833acfe548fa0263e1ed7abead47](https://bscscan.com/tx/0x9338c6ea84d0ba2279befdc5554a316325d7833acfe548fa0263e1ed7abead47) | 132988707 | 2026-11-11T10:01:40.000-05:00 | `0xa4c86f4e9d9ec8990f843aa49470083cece5f908` | 25000 |
| [0xa00752039a53edf780315ec60898e60e444ba8bd2a9fdf379a7a2141491dbf9a](https://bscscan.com/tx/0xa00752039a53edf780315ec60898e60e444ba8bd2a9fdf379a7a2141491dbf9a) | 133060550 | 2026-11-11T19:00:37.000-05:00 | `0x252dd866b4e34351d14d7239963979e0ef138765` | 300000 |
| [0x7a5adb0654e6ace5b04fa99d1a6ba2ccfa901cce25943c338cb7ec188cc308af](https://bscscan.com/tx/0x7a5adb0654e6ace5b04fa99d1a6ba2ccfa901cce25943c338cb7ec188cc308af) | 133060608 | 2026-11-11T19:01:03.000-05:00 | `0xec2f03b4baa1dc49559e56a54f84a2e9f2a30a91` | 300000 |
| [0x6800f8e9fec9f9410e3d7f23a7e9ae3c780f274b953dbf66e26362064df9f5f6](https://bscscan.com/tx/0x6800f8e9fec9f9410e3d7f23a7e9ae3c780f274b953dbf66e26362064df9f5f6) | 133060676 | 2026-11-11T19:01:33.000-05:00 | `0x75ca85a045b6648b31e335bc9742efebcaf778b4` | 15000 |
| [0x7d62a5d97fa53fa2312f25ff978125d84303c7270a5417fc3bd8f09afc586475](https://bscscan.com/tx/0x7d62a5d97fa53fa2312f25ff978125d84303c7270a5417fc3bd8f09afc586475) | 133060725 | 2026-11-11T19:01:55.000-05:00 | `0x6e9c17439cf81247965f9543645cfc8e746c4588` | 15000 |
| [0x1db1af0171550711559be50f6600d5f65e755bf959dc67ca9bb7eec02c677b10](https://bscscan.com/tx/0x1db1af0171550711559be50f6600d5f65e755bf959dc67ca9bb7eec02c677b10) | 133060774 | 2026-11-11T19:02:17.000-05:00 | `0x4d2a5410f0d0733c0448e91e47608ebdc918a806` | 15000 |
| [0x185177990f4ddbc0e6f79f9f0d9fb7e93fa1b5e3188a54d0d1884a4ddcf88304](https://bscscan.com/tx/0x185177990f4ddbc0e6f79f9f0d9fb7e93fa1b5e3188a54d0d1884a4ddcf88304) | 133060825 | 2026-11-11T19:02:40.000-05:00 | `0xfb200657f7266157a45dfcc6c09690726daa24e6` | 15000 |
| [0x169304db0c790d99fadc03045edc26dcacf874caee8929927bebdd3e58a483f7](https://bscscan.com/tx/0x169304db0c790d99fadc03045edc26dcacf874caee8929927bebdd3e58a483f7) | 133060873 | 2026-11-11T19:03:02.000-05:00 | `0x7da3ca7215a7d39e6f0f29dac6ead13024ac7744` | 15000 |
| [0x9bcb2f0e4458df1ddece18477ee2a9383743fa3db79012f80f5edfe4807fdeb0](https://bscscan.com/tx/0x9bcb2f0e4458df1ddece18477ee2a9383743fa3db79012f80f5edfe4807fdeb0) | 133060930 | 2026-11-11T19:03:28.000-05:00 | `0xc00d98e7c3ba26c811a0763dbdc58b3c368b0fab` | 15000 |
| [0x66b5e5abde2fd8b1fb6ebb18a0f70a6ad4daa099781fda07ef1431dbf83347b6](https://bscscan.com/tx/0x66b5e5abde2fd8b1fb6ebb18a0f70a6ad4daa099781fda07ef1431dbf83347b6) | 133060982 | 2026-11-11T19:03:51.000-05:00 | `0xab97087102fa0d6a9373aaa5473224d00ae782f7` | 15000 |
| [0x7e05194028c3c8645848ea2857f44c8ed154f3e5c070e8de1a7354273a81ba77](https://bscscan.com/tx/0x7e05194028c3c8645848ea2857f44c8ed154f3e5c070e8de1a7354273a81ba77) | 133061033 | 2026-11-11T19:04:14.000-05:00 | `0xd01f18a13e8d84da238e2e0f18b4f81de5670dca` | 15000 |
| [0x8756d1f3d633b51d7b334a3c9afeba4b54c7467a682a3ec73e90e4bd3980b23b](https://bscscan.com/tx/0x8756d1f3d633b51d7b334a3c9afeba4b54c7467a682a3ec73e90e4bd3980b23b) | 133061755 | 2026-11-11T19:09:39.000-05:00 | `0x8043ed9e7b0b46322f2932de92fb5ec0a5a031fe` | 15000 |
| [0x590b3ffc9899bcf8dafa9050dca1ecdc82bdebb6a4801daddd5adeb816e1088b](https://bscscan.com/tx/0x590b3ffc9899bcf8dafa9050dca1ecdc82bdebb6a4801daddd5adeb816e1088b) | 133065517 | 2026-11-11T19:37:53.000-05:00 | `0x207581ac0916523f674ba74d17910e2e2f7e51a0` | 15000 |
| [0x0af41da68310390202f2e4b49169985055045f2b4672f95ae56ebe10ce719bdb](https://bscscan.com/tx/0x0af41da68310390202f2e4b49169985055045f2b4672f95ae56ebe10ce719bdb) | 133065571 | 2026-11-11T19:38:17.000-05:00 | `0x128edc3f509f19c7dcf866c9655f6b6e41db3ff6` | 15000 |
| [0x725915e68f2dd03af11baed0bd044a280c99ecd6f949e6b3673e6c47dade7347](https://bscscan.com/tx/0x725915e68f2dd03af11baed0bd044a280c99ecd6f949e6b3673e6c47dade7347) | 133065626 | 2026-11-11T19:38:42.000-05:00 | `0xe1977ff4e6bb3ed670ebd1453690044495826104` | 15000 |
| [0xeea78053d359745f61076359f8597720ae14b12529e1d5373b9ac466ce8c09cd](https://bscscan.com/tx/0xeea78053d359745f61076359f8597720ae14b12529e1d5373b9ac466ce8c09cd) | 133065676 | 2026-11-11T19:39:04.000-05:00 | `0xeb50468f2bb2af90cad3b684f5481398a5d40ab9` | 15000 |

Total: **1545000 FLAPJAX** across 31 receipts and 28 distinct recipients.

## Funding status

Head balance, transaction count and code are independently checked. A zero balance and zero nonce on a code-free address are evidence consistent with no funding; they are not a complete historical trace. First funders of funded addresses are unresolved in this evidence. A group count cannot be justified from these observations alone.

| Address | BNB | Nonce | Status |
|---|---:|---:|---|
| `0xbbd270b71bc4dfe1a0ed599d7d4df562124d3162` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xf4c0d36fea1f4661d29c7910c9adca30fce7f587` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xda02162f9c851104c4ad070e096b52192c655ee4` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0x9eaac1a54a13cccbb013757b8a2095d1066f3ed9` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0x0fc2d96480cc26c0d3f7fe10e56bf5a211f3db8f` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xb6d00a148ad63fd9ccdd484b687c6012ba1561e1` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0x86545df67ec0f718fb5816cfd859a08f90d79f11` | 0 | 44 | first funder requires history |
| `0xe676d62db070880817c752eae3d984644b0c71d4` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0x97cd18b8bbb629b17675d868259ea84c0a2a5a9c` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xee0821be193086fe6648b8051e39510ac95b358f` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xfb200657f7266157a45dfcc6c09690726daa24e6` | 0.0005 | 0 | first funder requires history |
| `0xabc2c3daffa4c1963299da225c25f2aa7d4ddf62` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xdf4ff9d2f45f99f11a90b16f277d4b7edddb72a5` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xa4c86f4e9d9ec8990f843aa49470083cece5f908` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0x252dd866b4e34351d14d7239963979e0ef138765` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xec2f03b4baa1dc49559e56a54f84a2e9f2a30a91` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0x75ca85a045b6648b31e335bc9742efebcaf778b4` | 0.0005 | 0 | first funder requires history |
| `0x6e9c17439cf81247965f9543645cfc8e746c4588` | 0.0005 | 0 | first funder requires history |
| `0x4d2a5410f0d0733c0448e91e47608ebdc918a806` | 0.0005 | 1 | first funder requires history |
| `0x7da3ca7215a7d39e6f0f29dac6ead13024ac7744` | 0.0005 | 0 | first funder requires history |
| `0xc00d98e7c3ba26c811a0763dbdc58b3c368b0fab` | 0.00250724 | 0 | first funder requires history |
| `0xab97087102fa0d6a9373aaa5473224d00ae782f7` | 0.0005 | 0 | first funder requires history |
| `0xd01f18a13e8d84da238e2e0f18b4f81de5670dca` | 0.001 | 1 | first funder requires history |
| `0x8043ed9e7b0b46322f2932de92fb5ec0a5a031fe` | 0.0005 | 0 | first funder requires history |
| `0x207581ac0916523f674ba74d17910e2e2f7e51a0` | 0.0005 | 0 | first funder requires history |
| `0x128edc3f509f19c7dcf866c9655f6b6e41db3ff6` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |
| `0xe1977ff4e6bb3ed670ebd1453690044495826104` | 0.002753136 | 34 | first funder requires history |
| `0xeb50468f2bb2af90cad3b684f5481398a5d40ab9` | 0 | 0 | no native funding evident at head; historical internal movements not excluded |

## Claim boundary

This is a partial independently verified deliverable, not an accepted claim or income. Do not submit as a full Q98 audit unless first-funder history, first-timer age, and an uncovered eligible receipt are verified. No payment, transaction signing or public promotional posting has been performed.

## Follow-up: historical BNB funding receipts

Independently checked at 2026-11-15 08:04 UTC using a public BSC endpoint; [execution evidence](https://github.com/ilhamraduanbis-source/toyol-digital/actions/runs/43692810064). Successful receipts and matching recipient/value or system-event evidence establish these actual funding events. Their earliest-ever status is not independently established by a full native-transaction history.

| Recipient | Funding source | BNB | Block | Receipt |
|---|---|---:|---:|---|
| `0xfb200657f7266157a45dfcc6c09690726daa24e6` | FlapJax treasury | 0.0005 | 126835408 | [BSC receipt](https://bscscan.com/tx/0xa3d7042983f4f2352b9b8f324414688db10887e2b2b2a125deca9a8bec6624e7) |
| `0x86545df67ec0f718fb5816cfd859a08f90d79f11` | BSC system cross-chain relay | 0.24522463 | 8383429 | [BSC receipt](https://bscscan.com/tx/0x25b5f027f7dd0844f48aa05db43906df07a5eb43caa2207be692009836b40a94) |
| Treasury `0x7c34e9e21ee28a49ff0b84b61774119e6633359f` | `0x5ba434b40be6cfc7033bf8d4545320fa609a4268` | 0.12638071 | 123473817 | [BSC receipt](https://bscscan.com/tx/0xe0f7aeeedd38558ba63a596b8eb6b73e53af63d6282fc3e370160f3b2109bfd0) |

The known historical receipt leads are attributed to the prior public M3GAN audit linked above. The relay is a system source, not proof of a common human operator. Sixteen recipients have zero current BNB, zero nonce and no code; ten other funded recipients have no independently established first-funder history. Do not convert unresolved funders into confirmed separate operators. The seven equal-balance wallets remain a hypothesis rather than a verified common funding group.

Eligibility gate at 08:04 UTC: the task was open with 19 submissions and zero recorded awards; no submission from Toyol's Base wallet. Taskmarket public records show agent 1176585 on the Base sales entry dated 2026-11-15 and agent 834 on a Tempo entry dated 2026-11-13. These are submission timestamps, not creation dates. Neither establishes the required seven-day age of the exact account and agent ID. No claim was submitted; no reward has been earned from Q98.
