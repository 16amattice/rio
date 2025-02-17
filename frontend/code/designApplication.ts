import {
    Color,
    ColorSet,
    ImageFill,
    LinearGradientFill,
    SolidFill,
} from './dataModels';
import { colorToCssString } from './cssUtils';

const ICON_PROMISE_CACHE: { [key: string]: Promise<string> } = {};

/// Removes any switcheroos from the given element
function removeSwitcheroos(element: HTMLElement): void {
    element.classList.remove(
        'rio-switcheroo-background',
        'rio-switcheroo-neutral',
        'rio-switcheroo-hud',
        'rio-switcheroo-primary',
        'rio-switcheroo-secondary',
        'rio-switcheroo-success',
        'rio-switcheroo-warning',
        'rio-switcheroo-danger',
        'rio-switcheroo-disabled',
        'rio-switcheroo-custom',
        'rio-switcheroo-bump'
    );
}

export function applySwitcheroo(
    element: HTMLElement,
    colorSet: ColorSet | 'bump'
): void {
    // Remove any preexisting switcheroos
    removeSwitcheroos(element);

    // If no color set is desired don't apply any new one
    if (colorSet === 'keep') {
        return;
    }

    // Is this a well-known switcheroo?
    if (typeof colorSet === 'string') {
        element.classList.add(`rio-switcheroo-${colorSet}`);
        return;
    }

    // Custom color sets need additional variables to be defined
    element.style.setProperty(
        '--rio-custom-local-bg',
        colorToCssString(colorSet.localBg)
    );
    element.style.setProperty(
        '--rio-custom-local-bg-variant',
        colorToCssString(colorSet.localBgVariant)
    );
    element.style.setProperty(
        '--rio-custom-local-bg-active',
        colorToCssString(colorSet.localBgActive)
    );
    element.style.setProperty(
        '--rio-custom-local-fg',
        colorToCssString(colorSet.localFg)
    );

    // Apply the switcheroo
    element.classList.add('rio-switcheroo-custom');
}

export function applyFillToSVG(
    svgRoot: SVGSVGElement,
    fillLike:
        | SolidFill
        | LinearGradientFill
        | ImageFill
        | Color
        | ColorSet
        | 'dim'
): void {
    // The svg element may already have a fill, so we must make sure that every
    // fill overwrites every other fill's style properties.
    let styleFill: string;
    let opacity: string = '1';

    // Case: No fill was provided, so use the default foreground color
    if (fillLike === 'keep') {
        styleFill = 'var(--rio-local-text-color)';
    }
    // Case: "dim". This is a special case, which is represented by also using
    // the foreground color, but with a reduced opacity.
    else if (fillLike === 'dim') {
        styleFill = 'var(--rio-local-text-color)';
        opacity = '0.4';
    }
    // Case: Well known, predefined colorset.
    //
    // Note that this uses the background rather than foreground color. The
    // foreground is intended to be used if the background was already set to
    // background color.
    else if (typeof fillLike === 'string') {
        styleFill = `var(--rio-global-${fillLike}-bg)`;
    }
    // Case: single color
    else if (Array.isArray(fillLike)) {
        styleFill = colorToCssString(fillLike);
    }
    // Case: Colorset
    else if (fillLike['localBg'] !== undefined) {
        // @ts-ignore
        styleFill = colorToCssString(fillLike.localBg);
    }
    // Case: Actual Fill object
    else {
        fillLike = fillLike as SolidFill | LinearGradientFill | ImageFill;

        switch (fillLike.type) {
            case 'solid':
                styleFill = colorToCssString(fillLike.color);
                break;

            case 'linearGradient':
                styleFill = createLinearGradientFillAndReturnFill(
                    svgRoot,
                    fillLike.angleDegrees,
                    fillLike.stops
                );
                break;

            case 'image':
                styleFill = createImageFillAndReturnFill(
                    svgRoot,
                    fillLike.imageUrl,
                    fillLike.fillMode
                );
                break;

            default:
                throw new Error(`Invalid fill type: ${fillLike}`);
        }
    }

    svgRoot.style.fill = styleFill;
    svgRoot.style.opacity = opacity;
}

function createLinearGradientFillAndReturnFill(
    svgRoot: SVGSVGElement,
    angleDegrees: number,
    stops: [Color, number][]
): string {
    // Create a new linear gradient
    const gradientId = generateUniqueId();
    const gradient = createLinearGradient(gradientId, angleDegrees, stops);

    // Add it to the "defs" section of the SVG
    let defs = svgRoot.querySelector('defs');

    if (defs === null) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgRoot.appendChild(defs);
    }

    defs.appendChild(gradient);

    // Add the gradient to the path
    return `url(#${gradientId})`;
}

function createImageFillAndReturnFill(
    svgRoot: SVGSVGElement,
    imageUrl: string,
    fillMode: 'fit' | 'stretch' | 'zoom'
): string {
    let aspectRatio = {
        stretch: 'none',
        fit: 'xMidYMid meet', // FIXME
        zoom: 'xMidYMid slice',
    }[fillMode];

    // Create a pattern
    const patternId = generateUniqueId();
    const pattern = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'pattern'
    );
    pattern.setAttribute('id', patternId);
    pattern.setAttribute('width', '100%');
    pattern.setAttribute('height', '100%');

    // Create an image
    const image = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'image'
    );
    image.setAttribute('href', imageUrl);
    image.setAttribute('width', '100%');
    image.setAttribute('height', '100%');
    image.setAttribute('preserveAspectRatio', aspectRatio);
    pattern.appendChild(image);

    // Add the pattern to the "defs" section of the SVG
    let defs = svgRoot.querySelector('defs');

    if (defs === null) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgRoot.appendChild(defs);
    }

    defs.appendChild(pattern);

    // Apply the pattern to the path
    return `url(#${patternId})`;
}

function generateUniqueId(): string {
    return Math.random().toString(36);
}

function createLinearGradient(
    gradientId: string,
    angleDegrees: number,
    stops: [Color, number][]
): SVGLinearGradientElement {
    const gradient = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'linearGradient'
    );
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('gradientTransform', `rotate(${angleDegrees})`);

    let ii = -1;
    for (const [color, offset] of stops) {
        ii += 1;

        const [r, g, b, a] = color;
        const stop = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'stop'
        );

        stop.setAttribute('offset', `${offset}`);
        stop.setAttribute(
            'style',
            `stop-color: rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`
        );
        stop.setAttribute('id', `${gradientId}-stop-${ii}`);
        gradient.appendChild(stop);
    }

    return gradient;
}

export async function applyIcon(
    target: HTMLElement,
    iconName: string,
    cssColor: string
): Promise<void> {
    // Is the icon already in the cache?
    let promise = ICON_PROMISE_CACHE[iconName];

    // No, load it from the server
    if (promise === undefined) {
        console.debug(`Fetching icon ${iconName} from server`);

        promise = fetch(`/rio/icon/${iconName}`).then((response) =>
            response.text()
        );

        ICON_PROMISE_CACHE[iconName] = promise;
    }

    // Avoid races: When calling this function multiple times on the same
    // element it can sometimes assign the first icon AFTER the second one, thus
    // ending up with the wrong icon in the end.
    //
    // To avoid this, assign the icon that's supposed to be loaded into the HTML
    // element as a data attribute. Once the icon's source has been fetched,
    // only apply it if the data attribute still matches the icon name.
    target.setAttribute('data-rio-icon', iconName);

    // Await the future
    let svgSource: string;
    try {
        svgSource = await promise;
    } catch (err) {
        console.error(`Error loading icon ${iconName}: ${err}`);
        delete ICON_PROMISE_CACHE[iconName];
        return;
    }

    // Check if the icon is still needed
    if (target.getAttribute('data-rio-icon') !== iconName) {
        return;
    }
    target.removeAttribute('data-rio-icon');

    // Apply the icon
    target.innerHTML = svgSource;

    // Apply the color
    let svgRoot = target.querySelector('svg') as SVGSVGElement;
    svgRoot.style.fill = cssColor;
}
