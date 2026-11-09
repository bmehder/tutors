import { List$Empty, List$NonEmpty } from '../prelude.mjs'
import { fold } from '../gleam_stdlib/gleam/list.mjs'

export const toList = values => values.reduceRight(
	(rest, first) => List$NonEmpty(first, rest),
	List$Empty(),
)

export function toArray(list) {
	return fold(list, [], (values, item) => {
		values.push(item)
		return values
	})
}
